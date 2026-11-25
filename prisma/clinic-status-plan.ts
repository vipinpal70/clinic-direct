// Pure decision logic for prisma/migrate-clinic-status.ts, kept separate so it
// can be tested without a database.

export interface PlanClinic {
  tag: string | null;
  status: string;
  agreement: string;
  agreementLocked: boolean | null;
  agreementSentAt: Date | null;
  agreementAcceptedAt: Date | null;
  agreementApprovedAt: Date | null;
  activatedAt: Date | null;
  createdAt: Date;
}

export interface PlanFacts {
  /** Commission + invoice records for this clinic. */
  earnings: number;
  /** An admin set its current suspended / inactive status (from the audit log). */
  adminSetStatus: boolean;
}

export interface Plan {
  status?: "new" | "in_progress";
  agreement?: "accepted" | "sent";
  activatedAt?: Date | null; // null = clear it
  notes: string[];
}

export function planClinic(c: PlanClinic, facts: PlanFacts): Plan {
  const plan: Plan = { notes: [] };
  if (c.tag === "client") return plan;

  // Older webhooks reset `agreement` without clearing the dates behind it.
  // Re-sending clears agreementAcceptedAt, so when set it is a live signature.
  if (c.agreementAcceptedAt && c.agreement !== "accepted") plan.agreement = "accepted";
  else if (c.agreementSentAt && c.agreement === "not_sent") plan.agreement = "sent";

  if (c.agreementLocked) {
    // Properly approved: only needs its activation date.
    if (!c.activatedAt) {
      plan.activatedAt = c.agreementApprovedAt ?? c.createdAt;
      if (!c.agreementApprovedAt) plan.notes.push("CHECK: no approval date, used record creation");
    }
    return plan;
  }

  // Never approved, so not really active / suspended: older imports copied that
  // from the Shopify account state.
  if (!["active", "suspended", "pending"].includes(c.status)) return plan;
  if (c.status === "suspended" && facts.adminSetStatus) {
    plan.notes.push("kept: an admin suspended it");
    return plan;
  }
  if (c.status === "active" && facts.earnings > 0) {
    plan.notes.push("REVIEW: kept active — never approved, but has commission or invoice records");
    return plan;
  }
  plan.status = c.agreementSentAt || ["sent", "viewed"].includes(c.agreement) ? "in_progress" : "new";
  if (c.activatedAt) plan.activatedAt = null;
  return plan;
}
