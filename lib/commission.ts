import { prisma } from "@/lib/prisma";

/**
 * Resolves the percentage commission rate for a clinic: a clinic-specific
 * rule (highest priority active `clinic:{id}` rule) wins, then the active
 * `default` rule, falling back to the clinic's own commissionPct.
 */
export async function resolveCommissionPct(clinicId: string): Promise<number> {
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

  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
  return clinic?.commissionPct ?? 12;
}

export function computeCommission(total: number, pct: number): number {
  return Math.round(total * pct) / 100;
}
