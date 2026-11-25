import { prisma } from "@/lib/prisma";

/**
 * Commission rate for a clinic, highest priority first:
 *   1. an active clinic-specific rule (`clinic:{id}`) — an explicit override
 *   2. the rate agreed in the clinic's approved agreement (e.g. 10%)
 *   3. the active `default` rule
 *   4. the clinic's own commissionPct (12 unless changed)
 * Before this, a default rule beat the agreed rate.
 */
export async function resolveCommissionPct(clinicId: string): Promise<number> {
  const clinicRule = await prisma.commissionRule.findFirst({
    where: { scope: `clinic:${clinicId}`, active: true, basis: "percentage" },
    orderBy: { priority: "desc" },
  });
  if (clinicRule) return clinicRule.value;

  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    select: { commissionPct: true, agreementLocked: true },
  });
  if (clinic?.agreementLocked) return clinic.commissionPct;

  const defaultRule = await prisma.commissionRule.findFirst({
    where: { scope: "default", active: true, basis: "percentage" },
    orderBy: { priority: "desc" },
  });
  if (defaultRule) return defaultRule.value;

  return clinic?.commissionPct ?? 12;
}

export function computeCommission(total: number, pct: number): number {
  return Math.round(total * pct) / 100;
}

interface ActivationState {
  status: string;
  activatedAt: Date | null;
}

/**
 * An order earns commission only if it was placed once its clinic was active.
 * Clinics activated before `activatedAt` existed have none and are eligible
 * while active (see prisma/migrate-clinic-status.ts).
 */
export function earnsCommission(clinic: ActivationState, orderPlacedAt: Date): boolean {
  if (clinic.activatedAt) return orderPlacedAt >= clinic.activatedAt;
  return clinic.status === "active";
}

/** Rate and commission to store on an order for this clinic. */
export async function orderCommission(
  clinic: ActivationState & { id: string },
  total: number,
  orderPlacedAt: Date,
): Promise<{ commissionPct: number; commission: number }> {
  if (!earnsCommission(clinic, orderPlacedAt)) return { commissionPct: 0, commission: 0 };
  const commissionPct = await resolveCommissionPct(clinic.id);
  return { commissionPct, commission: computeCommission(total, commissionPct) };
}
