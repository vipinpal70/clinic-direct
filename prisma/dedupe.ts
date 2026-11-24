/**
 * One-off de-duplication of Shopify-sourced data.
 *
 * Both the inbound webhooks and the admin API pull write clinics/orders, so a
 * customer whose note clinic-code appeared in one sync and not the next could
 * end up as two rows (a real code + a CLINIC-<id> fallback). This script
 * collapses those, re-points related orders/commissions/invoices at the
 * survivor, and removes exact-duplicate orders/invoices.
 *
 *   npx tsx prisma/dedupe.ts           # dry run — prints the plan, changes nothing
 *   npx tsx prisma/dedupe.ts --apply   # execute
 *
 * Run this BEFORE relying on the new ingest guards against historical data.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const FALLBACK_CODE = /^(CLINIC|CUST)-/i;
const isFallbackCode = (code: string) => FALLBACK_CODE.test(code);
const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

// ── union-find ────────────────────────────────────────────────────
class UnionFind {
  private parent = new Map<string, string>();
  add(x: string) {
    if (!this.parent.has(x)) this.parent.set(x, x);
  }
  find(x: string): string {
    let r = x;
    while (this.parent.get(r) !== r) r = this.parent.get(r)!;
    while (this.parent.get(x) !== r) {
      const next = this.parent.get(x)!;
      this.parent.set(x, r);
      x = next;
    }
    return r;
  }
  union(a: string, b: string) {
    this.parent.set(this.find(a), this.find(b));
  }
}

type Clinic = Awaited<ReturnType<typeof prisma.clinic.findMany>>[number];

// Higher score = better survivor (keeps the most admin-entered state).
function score(c: Clinic): number {
  let s = 0;
  if (c.agreementSnapshot) s += 100;
  if (c.detailsSubmittedAt) s += 60;
  if (c.agreementId) s += 25;
  if (c.loginHash) s += 15;
  if (!isFallbackCode(c.code)) s += 10;
  if (c.agreementLocked) s += 10;
  for (const v of [c.phone, c.address, c.website, c.businessName, c.vatNumber, c.bankDetails, c.taxExempt]) {
    if (v) s += 2;
  }
  if (c.commissionPct !== 12) s += 1;
  return s;
}

function pickSurvivor(rows: Clinic[]): Clinic {
  return [...rows].sort(
    (a, b) => score(b) - score(a) || a.createdAt.getTime() - b.createdAt.getTime(),
  )[0];
}

// Fields copied loser → survivor when the survivor's is empty.
const FILL_FIELDS = [
  "shopifyCustomerId", "clinicCode", "phone", "address", "website", "businessName", "vatNumber",
  "loginEmail", "loginHash", "bankDetails", "taxExempt", "detailsSubmittedAt",
  "agreementId", "agreementSnapshot", "agreementCommissionPct", "agreementExpiry",
  "agreementSentAt", "agreementAcceptedAt", "agreementApprovedAt", "agreementSignedName",
] as const;

async function dedupeClinics() {
  const clinics = await prisma.clinic.findMany();
  console.log(`\nClinics: ${clinics.length} rows`);

  // Normalise blank shopifyCustomerId → null so it doesn't act as a join key.
  const blankSid = clinics.filter((c) => c.shopifyCustomerId === "");
  if (blankSid.length) {
    console.log(`  • ${blankSid.length} rows have shopifyCustomerId="" → will null them`);
    if (APPLY) {
      await prisma.clinic.updateMany({
        where: { shopifyCustomerId: "" },
        data: { shopifyCustomerId: null },
      });
    }
  }

  const uf = new UnionFind();
  clinics.forEach((c) => uf.add(c.id));

  const firstBySid = new Map<string, string>();
  const firstByEmail = new Map<string, string>();
  for (const c of clinics) {
    const sid = (c.shopifyCustomerId ?? "").trim();
    if (sid) {
      if (firstBySid.has(sid)) uf.union(c.id, firstBySid.get(sid)!);
      else firstBySid.set(sid, c.id);
    }
    const email = norm(c.email);
    if (email) {
      const key = `${c.tag}:${email}`;
      if (firstByEmail.has(key)) uf.union(c.id, firstByEmail.get(key)!);
      else firstByEmail.set(key, c.id);
    }
  }

  const groups = new Map<string, Clinic[]>();
  for (const c of clinics) {
    const root = uf.find(c.id);
    const g = groups.get(root);
    if (g) g.push(c);
    else groups.set(root, [c]);
  }

  let merged = 0;
  let deleted = 0;
  for (const rows of groups.values()) {
    if (rows.length < 2) continue;

    const sids = [...new Set(rows.map((r) => (r.shopifyCustomerId ?? "").trim()).filter(Boolean))];
    if (sids.length > 1) {
      console.log(
        `  ⚠ CONFLICT (not merged) — ${rows.length} rows share an email but have different shopifyCustomerId:`,
        rows.map((r) => `${r.code}[sid:${r.shopifyCustomerId}]`).join(", "),
      );
      continue;
    }

    const survivor = pickSurvivor(rows);
    const losers = rows.filter((r) => r.id !== survivor.id);
    const loserIds = losers.map((r) => r.id);

    const fill: Record<string, unknown> = {};
    for (const f of FILL_FIELDS) {
      if (!survivor[f as keyof Clinic]) {
        const donor = losers.find((l) => l[f as keyof Clinic]);
        if (donor) fill[f] = donor[f as keyof Clinic];
      }
    }
    // Upgrade a fallback survivor code to a real one from a loser.
    if (isFallbackCode(survivor.code)) {
      const real = losers.find((l) => !isFallbackCode(l.code));
      if (real) fill.code = real.code;
    }

    console.log(
      `  • merge ${losers.map((l) => l.code).join(", ")} → ${survivor.code}` +
        (fill.code ? ` (code→${fill.code})` : "") +
        (Object.keys(fill).filter((k) => k !== "code").length
          ? ` [+${Object.keys(fill).filter((k) => k !== "code").join(",")}]`
          : ""),
    );
    merged += losers.length;
    deleted += losers.length;

    if (APPLY) {
      const reassign = { where: { clinicId: { in: loserIds } }, data: { clinicId: survivor.id } };
      await prisma.order.updateMany(reassign);
      await prisma.commission.updateMany(reassign);
      await prisma.invoice.updateMany(reassign);

      if (Object.keys(fill).length) {
        // Free the real code from the loser first to avoid a @unique clash.
        if (fill.code) {
          await prisma.clinic.updateMany({
            where: { code: fill.code as string },
            data: { code: `__migrating_${Date.now()}` },
          });
        }
        await prisma.clinic.update({ where: { id: survivor.id }, data: fill as never });
      }
      await prisma.clinic.deleteMany({ where: { id: { in: loserIds } } });
    }
  }
  console.log(`  → ${merged} duplicate clinic rows folded, ${deleted} to delete`);
}

async function dedupeByKey(
  label: string,
  rows: { id: string; key: string; updatedAt: Date }[],
  del: (ids: string[]) => Promise<unknown>,
) {
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const g = groups.get(r.key);
    if (g) g.push(r);
    else groups.set(r.key, [r]);
  }

  const toDelete: string[] = [];
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const [keep, ...drop] = [...g].sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
    );
    console.log(`  • ${label} "${keep.key}": keep 1, drop ${drop.length}`);
    toDelete.push(...drop.map((d) => d.id));
  }
  console.log(`  → ${toDelete.length} duplicate ${label} rows to delete`);
  if (APPLY && toDelete.length) await del(toDelete);
}

async function main() {
  console.log(APPLY ? "APPLY mode — changes will be written." : "DRY RUN — nothing will change.");

  await dedupeClinics();

  const orders = await prisma.order.findMany({ select: { id: true, shopifyId: true, updatedAt: true } });
  console.log(`\nOrders: ${orders.length} rows`);
  await dedupeByKey(
    "order",
    orders.map((o) => ({ id: o.id, key: o.shopifyId, updatedAt: o.updatedAt })),
    (ids) => prisma.order.deleteMany({ where: { id: { in: ids } } }),
  );

  const invoices = await prisma.invoice.findMany({
    select: { id: true, number: true, clinicId: true, periodStart: true, updatedAt: true },
  });
  console.log(`\nInvoices: ${invoices.length} rows`);
  await dedupeByKey(
    "invoice#",
    invoices.map((i) => ({ id: i.id, key: i.number, updatedAt: i.updatedAt })),
    (ids) => prisma.invoice.deleteMany({ where: { id: { in: ids } } }),
  );
  // Report — do NOT auto-delete — multiple invoices for one clinic+period.
  const periodGroups = new Map<string, number>();
  for (const i of invoices) {
    const k = `${i.clinicId ?? "null"}|${i.periodStart?.toISOString() ?? "null"}`;
    periodGroups.set(k, (periodGroups.get(k) ?? 0) + 1);
  }
  const dupPeriods = [...periodGroups.entries()].filter(([, n]) => n > 1);
  if (dupPeriods.length) {
    console.log("  ⚠ clinic+period with >1 invoice (review manually):");
    for (const [k, n] of dupPeriods) console.log(`     ${k} → ${n}`);
  }

  console.log(APPLY ? "\nDone." : "\nDry run complete — re-run with --apply to execute.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
