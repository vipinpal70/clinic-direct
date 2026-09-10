/**
 * Demo / end-to-end test for the self-billed invoice flow.
 *
 * Seeds demo orders for the "Vishesh Test" clinic, then drives the full pipeline
 * exactly as the app does — commission run → approve → generate invoice → push —
 * and verifies the resulting numbers. The commission and invoice steps mirror
 * `app/api/commissions/route.ts` and `app/api/invoices/route.ts` so this exercises
 * the real logic without needing the dev server or an auth session.
 *
 *   npx tsx prisma/demo-invoice.ts                 # run for the current month
 *   npx tsx prisma/demo-invoice.ts --period 2026-09
 *   npx tsx prisma/demo-invoice.ts --push          # also push issued -> pushed
 *   npx tsx prisma/demo-invoice.ts --cleanup       # remove everything this script created
 *
 * All demo orders use a "demo-" shopifyId prefix, so cleanup is exact and reruns
 * are idempotent (orders upsert, no duplicates).
 */
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const CLINIC_CODE = "VISHESH";
const DEMO_PREFIX = "demo-";

const argv = process.argv.slice(2);
const CLEANUP = argv.includes("--cleanup");
const PUSH = argv.includes("--push");
const period =
  (() => {
    const i = argv.indexOf("--period");
    return i >= 0 ? argv[i + 1] : undefined;
  })() ?? new Date().toISOString().slice(0, 7); // "YYYY-MM"

if (!/^\d{4}-\d{2}$/.test(period)) {
  console.error(`Invalid --period "${period}" (expected YYYY-MM)`);
  process.exit(1);
}

const [year, month] = period.split("-").map(Number);
const periodStart = new Date(year, month - 1, 1);
const periodEnd = new Date(year, month, 1);
const gbp = (n: number) => `£${n.toFixed(2)}`;

// ── Demo order fixtures (mid-month so they land in the period window) ──────────
// One cancelled + one refunded prove the commission run excludes cancelled orders
// but still counts refunded ones (route excludes only `status: "cancelled"`).
const midMonth = new Date(year, month - 1, 15, 12, 0, 0);
const DEMO_ORDERS = [
  { total: 500, status: "fulfilled", product: "Mounjaro", items: 2 },
  { total: 250, status: "fulfilled", product: "Consultation", items: 1 },
  { total: 750, status: "processing", product: "Supplements", items: 3 },
  { total: 300, status: "refunded", product: "Eye Drops", items: 1 },
  { total: 999, status: "cancelled", product: "Glasses", items: 1 }, // excluded
] as const;

// ── Helpers mirrored from product code ─────────────────────────────────────────
// resolveCommissionPct (lib/commission.ts): clinic rule → default rule → clinic pct.
async function resolveCommissionPct(clinicId: string, fallbackPct: number) {
  const clinicRule = await prisma.commissionRule.findFirst({
    where: { scope: `clinic:${clinicId}`, active: true, basis: "percentage" },
    orderBy: { priority: "desc" },
  });
  if (clinicRule) return clinicRule.value;
  const defaultRule = await prisma.commissionRule.findFirst({
    where: { scope: "default", active: true, basis: "percentage" },
    orderBy: { priority: "desc" },
  });
  if (defaultRule) return defaultRule.value;
  return fallbackPct ?? 12;
}
const computeCommission = (total: number, pct: number) =>
  Math.round(total * pct) / 100; // lib/commission.ts

// nextInvoiceNumber + createInvoice (app/api/invoices/route.ts)
async function nextInvoiceNumber() {
  const prefix = `SBI-${new Date().getFullYear()}-`;
  const rows = await prisma.invoice.findMany({
    where: { number: { startsWith: prefix } },
    select: { number: true },
  });
  const maxSeq = rows.reduce((max, r) => {
    const n = parseInt(r.number.slice(prefix.length), 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, 999);
  return `${prefix}${maxSeq + 1}`;
}
async function createInvoice(data: Omit<Prisma.InvoiceUncheckedCreateInput, "number">) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.invoice.create({
        data: { ...data, number: await nextInvoiceNumber() },
      });
    } catch (error) {
      const raced =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      if (!raced || attempt === 4) throw error;
    }
  }
  throw new Error("Could not allocate an invoice number");
}

async function getClinic() {
  const clinic = await prisma.clinic.findUnique({ where: { code: CLINIC_CODE } });
  if (!clinic) throw new Error(`Clinic with code "${CLINIC_CODE}" not found`);
  return clinic;
}

// ── Cleanup ────────────────────────────────────────────────────────────────────
async function cleanup() {
  const clinic = await getClinic();
  console.log(`\n🧹 Cleaning up demo data for ${clinic.name} (${period})…`);

  // Delete the invoice(s) for this clinic+period, un-linking their commissions.
  const invoices = await prisma.invoice.findMany({
    where: { clinicId: clinic.id, periodStart },
    select: { id: true, number: true },
  });
  for (const inv of invoices) {
    await prisma.commission.updateMany({
      where: { invoiceId: inv.id },
      data: { invoiceId: null },
    });
    await prisma.invoice.delete({ where: { id: inv.id } });
    console.log(`   deleted invoice ${inv.number}`);
  }

  const commDel = await prisma.commission.deleteMany({
    where: { clinicId: clinic.id, period },
  });
  console.log(`   deleted ${commDel.count} commission record(s)`);

  const orderDel = await prisma.order.deleteMany({
    where: { clinicId: clinic.id, shopifyId: { startsWith: DEMO_PREFIX } },
  });
  console.log(`   deleted ${orderDel.count} demo order(s)`);
  console.log("✅ Cleanup complete.\n");
}

// ── Main flow ────────────────────────────────────────────────────────────────
async function run() {
  const clinic = await getClinic();
  console.log(`\n🏥 Clinic: ${clinic.name} (${clinic.code}) · status=${clinic.status}`);
  console.log(`📅 Period: ${period}  [${periodStart.toISOString().slice(0, 10)} → ${periodEnd
    .toISOString()
    .slice(0, 10)})\n`);

  const rate = await resolveCommissionPct(clinic.id, clinic.commissionPct);
  console.log(`💷 Resolved commission rate: ${rate}%`);

  // ── STEP 1: seed demo orders (upsert by shopifyId so reruns don't duplicate) ──
  console.log("\n── Step 1: Seed demo orders ────────────────────────────");
  for (let i = 0; i < DEMO_ORDERS.length; i++) {
    const o = DEMO_ORDERS[i];
    const shopifyId = `${DEMO_PREFIX}${period}-${i + 1}`;
    const commission = computeCommission(o.total, rate);
    await prisma.order.upsert({
      where: { shopifyId },
      update: {
        total: o.total,
        commission,
        commissionPct: rate,
        status: o.status,
        shopifyCreatedAt: midMonth,
      },
      create: {
        shopifyId,
        number: `#DEMO-${period}-${i + 1}`,
        clinicId: clinic.id,
        status: o.status,
        total: o.total,
        commission,
        commissionPct: rate,
        items: o.items,
        customerName: "Demo Patient",
        customerEmail: "demo.patient@example.com",
        lineItems: [{ title: o.product, quantity: o.items }],
        refundAmount: o.status === "refunded" ? o.total : undefined,
        shopifyCreatedAt: midMonth,
      },
    });
    console.log(
      `   ${shopifyId.padEnd(20)} ${gbp(o.total).padStart(9)}  ${o.status.padEnd(11)} ${
        o.status === "cancelled" ? "(excluded from commission)" : ""
      }`,
    );
  }

  // ── STEP 2: commission run (mirrors app/api/commissions/route.ts) ─────────────
  console.log("\n── Step 2: Commission run ──────────────────────────────");
  const orders = await prisma.order.findMany({
    where: {
      clinicId: clinic.id,
      shopifyCreatedAt: { gte: periodStart, lt: periodEnd },
      status: { notIn: ["cancelled"] },
    },
  });
  const gross = orders.reduce((s, o) => s + o.total, 0);
  const commission = computeCommission(gross, rate);
  const vat = Math.round(commission * 0.2 * 100) / 100;
  console.log(
    `   ${orders.length} eligible orders · gross ${gbp(gross)} · commission ${gbp(
      commission,
    )} · VAT ${gbp(vat)}`,
  );

  const existingComm = await prisma.commission.findFirst({
    where: { clinicId: clinic.id, period },
  });
  const commissionRecord = existingComm
    ? await prisma.commission.update({
        where: { id: existingComm.id },
        data: { gross, commission, rate, vat },
      })
    : await prisma.commission.create({
        data: { clinicId: clinic.id, period, gross, commission, rate, vat },
      });

  // ── STEP 3: approve the commission (finance step — invoices need "approved") ──
  console.log("\n── Step 3: Approve commission ──────────────────────────");
  await prisma.commission.update({
    where: { id: commissionRecord.id },
    data: { status: "approved" },
  });
  console.log(`   commission ${commissionRecord.id} → approved`);

  // ── STEP 4: generate invoice (mirrors app/api/invoices/route.ts POST) ─────────
  console.log("\n── Step 4: Generate invoice ────────────────────────────");
  const invoiceable = await prisma.commission.findMany({
    where: {
      period,
      status: "approved",
      OR: [{ invoiceId: null }, { invoiceId: { isSet: false } }],
    },
  });

  const byClinic = new Map<string, typeof invoiceable>();
  for (const c of invoiceable) {
    if (!c.clinicId) continue;
    byClinic.set(c.clinicId, [...(byClinic.get(c.clinicId) ?? []), c]);
  }

  const alreadyInvoiced = new Set(
    (
      await prisma.invoice.findMany({
        where: { periodStart, clinicId: { in: [...byClinic.keys()] } },
        select: { clinicId: true },
      })
    ).map((i) => i.clinicId),
  );

  let invoice = await prisma.invoice.findFirst({
    where: { clinicId: clinic.id, periodStart },
  });

  for (const [clinicId, records] of byClinic) {
    if (alreadyInvoiced.has(clinicId)) {
      if (clinicId === clinic.id)
        console.log(`   ⚠︎ clinic already invoiced for ${period} — skipped (idempotent).`);
      continue;
    }
    const commissionTotal = records.reduce((s, r) => s + r.commission, 0);
    const vatTotal = records.reduce((s, r) => s + r.vat, 0);
    const created = await createInvoice({
      clinicId,
      commission: commissionTotal,
      vat: vatTotal,
      total: commissionTotal + vatTotal,
      status: "issued",
      periodStart,
      periodEnd,
    });
    await prisma.commission.updateMany({
      where: { id: { in: records.map((r) => r.id) } },
      data: { invoiceId: created.id },
    });
    if (clinicId === clinic.id) invoice = created;
    console.log(`   created invoice ${created.number} (${created.status})`);
  }

  if (!invoice) throw new Error("No invoice was produced for the clinic");

  // ── STEP 5 (optional): push issued → pushed ───────────────────────────────────
  if (PUSH && invoice.status === "issued") {
    console.log("\n── Step 5: Push to Orderwise ───────────────────────────");
    invoice = await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: "pushed", pushedAt: new Date() },
    });
    console.log(`   ${invoice.number} → pushed (pushedAt=${invoice.pushedAt?.toISOString()})`);
  }

  // ── Report + verification ─────────────────────────────────────────────────────
  const linked = await prisma.commission.findMany({ where: { invoiceId: invoice.id } });
  console.log("\n══════════════════ RESULT ══════════════════");
  console.log(`Invoice number : ${invoice.number}`);
  console.log(`Clinic         : ${clinic.name}`);
  console.log(`Status         : ${invoice.status}`);
  console.log(`Commission     : ${gbp(invoice.commission)}`);
  console.log(`VAT (20%)      : ${gbp(invoice.vat)}`);
  console.log(`Total          : ${gbp(invoice.total)}`);
  console.log(`Period         : ${invoice.periodStart?.toISOString().slice(0, 10)} → ${invoice.periodEnd
    ?.toISOString()
    .slice(0, 10)}`);
  console.log(`Linked comms   : ${linked.length}`);
  console.log("═════════════════════════════════════════════");

  // Assertions
  const checks: [string, boolean][] = [
    ["total == commission + VAT", Math.abs(invoice.total - (invoice.commission + invoice.vat)) < 0.005],
    ["invoice.commission matches computed", Math.abs(invoice.commission - commission) < 0.005],
    ["VAT is 20% of commission", Math.abs(invoice.vat - Math.round(commission * 0.2 * 100) / 100) < 0.005],
    ["cancelled order excluded (gross = 1800, not 2799)", gross === 1800],
    ["commission linked to invoice", linked.length >= 1],
  ];
  console.log("\nVerification:");
  let ok = true;
  for (const [label, pass] of checks) {
    console.log(`   ${pass ? "✅" : "❌"} ${label}`);
    ok = ok && pass;
  }
  console.log(
    ok
      ? "\n🎉 Invoice flow verified end-to-end.\n"
      : "\n❌ Some checks failed — see above.\n",
  );
  if (!ok) process.exitCode = 1;
}

(CLEANUP ? cleanup() : run())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
