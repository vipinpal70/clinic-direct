/**
 * One-off: move clinics onto the new lifecycle (lib/clinic-status.ts).
 *
 *   npx tsx prisma/migrate-clinic-status.ts           # dry run — prints the plan
 *   npx tsx prisma/migrate-clinic-status.ts --apply   # execute
 *
 * - pending → in_progress if an agreement was sent, otherwise new
 * - active clinics without activatedAt get one: agreementApprovedAt, else
 *   createdAt. createdAt keeps commission exactly as before (every order counts).
 *   Review these and correct any date you know.
 * Safe to run more than once.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function main() {
  console.log(APPLY ? "APPLY mode — changes will be written." : "DRY RUN — nothing will change.");

  const legacy = await prisma.clinic.findMany({ where: { status: "pending" } });
  console.log(`\npending clinics: ${legacy.length}`);
  for (const c of legacy) {
    const status = c.agreement === "not_sent" ? "new" : "in_progress";
    console.log(`  • ${c.code} ${c.name}: pending → ${status} (agreement ${c.agreement})`);
    if (APPLY) await prisma.clinic.update({ where: { id: c.id }, data: { status } });
  }

  const active = await prisma.clinic.findMany({
    where: { status: "active", OR: [{ activatedAt: null }, { activatedAt: { isSet: false } }] },
  });
  console.log(`\nactive clinics without activatedAt: ${active.length}`);
  for (const c of active) {
    const activatedAt = c.agreementApprovedAt ?? c.createdAt;
    const source = c.agreementApprovedAt ? "agreement approval" : "record creation — CHECK";
    console.log(`  • ${c.code} ${c.name}: activatedAt = ${activatedAt.toISOString()} (${source})`);
    if (APPLY) await prisma.clinic.update({ where: { id: c.id }, data: { activatedAt } });
  }

  console.log(APPLY ? "\nDone." : "\nDry run complete — re-run with --apply to execute.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
