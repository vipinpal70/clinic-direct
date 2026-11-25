/**
 * One-off: move clinics onto the approval lifecycle (lib/clinic-status.ts).
 *
 *   npx tsx prisma/migrate-clinic-status.ts           # dry run — prints the plan
 *   npx tsx prisma/migrate-clinic-status.ts --apply   # execute (back up first)
 *
 * - Clinics never approved by an admin become new, or in_progress if an
 *   agreement was sent: older imports marked them active / suspended from the
 *   Shopify account state. Any activatedAt on them is cleared. Kept for review
 *   instead: active ones with commission or invoice records, and ones an admin
 *   suspended.
 * - Approved clinics without activatedAt get their approval date.
 * - Agreements that older webhooks reset are restored from their dates.
 * Decisions live in prisma/clinic-status-plan.ts. Safe to run more than once.
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import { planClinic } from "./clinic-status-plan";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function main() {
  console.log(APPLY ? "APPLY mode — changes will be written." : "DRY RUN — nothing will change.");
  const clinics = await prisma.clinic.findMany();
  let changed = 0;

  for (const c of clinics) {
    const [commissions, invoices, adminStatus] = await Promise.all([
      prisma.commission.count({ where: { clinicId: c.id } }),
      prisma.invoice.count({ where: { clinicId: c.id } }),
      prisma.auditLog.count({
        where: { action: "clinic.status.updated", target: c.name, newValue: c.status },
      }),
    ]);
    const plan = planClinic(c, {
      earnings: commissions + invoices,
      adminSetStatus: adminStatus > 0,
    });

    const data: Prisma.ClinicUpdateInput = {};
    const parts: string[] = [];
    if (plan.status) {
      data.status = plan.status;
      parts.push(`status ${c.status} → ${plan.status}`);
    }
    if (plan.agreement) {
      data.agreement = plan.agreement;
      parts.push(`agreement ${c.agreement} → ${plan.agreement}`);
    }
    if (plan.activatedAt !== undefined) {
      data.activatedAt = plan.activatedAt;
      parts.push(`activatedAt = ${plan.activatedAt ? plan.activatedAt.toISOString() : "cleared"}`);
    }
    if (parts.length === 0 && plan.notes.length === 0) continue;

    console.log(`  • ${c.clinicCode ?? c.code} ${c.name}: ${[...parts, ...plan.notes].join("; ")}`);
    if (parts.length > 0) {
      changed++;
      if (APPLY) await prisma.clinic.update({ where: { id: c.id }, data });
    }
  }

  console.log(`\n${changed} of ${clinics.length} records ${APPLY ? "changed" : "would change"}.`);
  if (!APPLY) console.log("Dry run complete — back up, then re-run with --apply.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
