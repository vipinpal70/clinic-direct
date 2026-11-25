/**
 * One-off: remove patient (shopper) data stored before it stopped being kept.
 *
 *   npx tsx prisma/remove-patient-data.ts           # dry run — prints the plan
 *   npx tsx prisma/remove-patient-data.ts --apply   # execute (back up first)
 *
 * 1. Deletes non-clinic customer rows (tag "client") from `clinics`, unless an
 *    order, commission or invoice points at one (those are listed instead).
 *    Clinics without a clinic code are listed for review, not deleted.
 * 2. Orders: stores the hashed shopper key (for sticky clinic codes), then
 *    clears customerName and customerEmail.
 * 3. Audit (webhook_events): strips patient data from stored payloads, drops
 *    raw bodies, and removes the old `clients` list from stored responses.
 * 4. webhook_logs: drops stored payloads.
 * Safe to run more than once.
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import { customerKey, redactWebhookPayload } from "../lib/pii";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const BATCH = 200;

async function removeClientRows() {
  const clients = await prisma.clinic.findMany({
    where: { tag: "client" },
    select: { id: true, code: true },
  });
  console.log(`\n1. Non-clinic customer rows: ${clients.length}`);
  let deleted = 0;
  for (const c of clients) {
    const [orders, commissions, invoices] = await Promise.all([
      prisma.order.count({ where: { clinicId: c.id } }),
      prisma.commission.count({ where: { clinicId: c.id } }),
      prisma.invoice.count({ where: { clinicId: c.id } }),
    ]);
    if (orders + commissions + invoices > 0) {
      console.log(`  ⚠ ${c.code}: kept — ${orders} orders, ${commissions} commissions, ${invoices} invoices point at it`);
      continue;
    }
    deleted++;
    if (APPLY) await prisma.clinic.delete({ where: { id: c.id } });
  }
  console.log(`  → ${deleted} to delete`);

  const noCode = await prisma.clinic.findMany({
    where: { tag: "clinic", OR: [{ clinicCode: null }, { clinicCode: { isSet: false } }] },
    select: { code: true, name: true },
  });
  if (noCode.length) {
    console.log(`  Review — clinics without a clinic code (not deleted): ${noCode.length}`);
    for (const c of noCode) console.log(`     ${c.code} ${c.name}`);
  }
}

async function scrubOrders() {
  const where: Prisma.OrderWhereInput = {
    OR: [
      { customerName: { not: null } },
      { customerEmail: { not: null } },
    ],
  };
  const total = await prisma.order.count({ where });
  console.log(`\n2. Orders holding a shopper name or email: ${total}`);
  if (!APPLY) return;
  for (;;) {
    const rows = await prisma.order.findMany({
      where,
      select: { id: true, customerEmail: true, customerKey: true },
      take: BATCH,
    });
    if (rows.length === 0) break;
    for (const o of rows) {
      await prisma.order.update({
        where: { id: o.id },
        data: {
          customerKey: o.customerKey ?? customerKey(o.customerEmail),
          customerName: { unset: true },
          customerEmail: { unset: true },
        },
      });
    }
  }
}

async function scrubAudit() {
  const total = await prisma.webhookEvent.count();
  console.log(`\n3. Audit requests to scrub: ${total}`);
  if (!APPLY) return;
  let cursor: string | undefined;
  for (;;) {
    const rows = await prisma.webhookEvent.findMany({
      orderBy: { id: "asc" },
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: { id: true, endpoint: true, topic: true, payload: true, rawBody: true, response: true },
    });
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1].id;
    for (const e of rows) {
      const response =
        e.response && typeof e.response === "object" && !Array.isArray(e.response) && "clients" in e.response
          ? Object.fromEntries(Object.entries(e.response).filter(([k]) => k !== "clients"))
          : undefined;
      await prisma.webhookEvent.update({
        where: { id: e.id },
        data: {
          ...(e.payload !== null && e.payload !== undefined
            ? { payload: redactWebhookPayload(e.endpoint, e.topic, e.payload) as Prisma.InputJsonValue }
            : {}),
          ...(e.rawBody ? { rawBody: "[removed]" } : {}),
          ...(response ? { response: response as Prisma.InputJsonValue } : {}),
        },
      });
    }
  }
}

async function scrubWebhookLogs() {
  // Json fields can't be filtered for null on MongoDB, so check in code.
  const rows = await prisma.webhookLog.findMany({ select: { id: true, payload: true } });
  const ids = rows.filter((r) => r.payload !== null && r.payload !== undefined).map((r) => r.id);
  console.log(`\n4. Webhook logs holding a payload: ${ids.length}`);
  if (APPLY && ids.length) {
    await prisma.webhookLog.updateMany({ where: { id: { in: ids } }, data: { payload: null } });
  }
}

async function main() {
  console.log(APPLY ? "APPLY mode — changes will be written." : "DRY RUN — nothing will change.");
  await removeClientRows();
  await scrubOrders();
  await scrubAudit();
  await scrubWebhookLogs();
  console.log(APPLY ? "\nDone." : "\nDry run complete — back up, then re-run with --apply.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
