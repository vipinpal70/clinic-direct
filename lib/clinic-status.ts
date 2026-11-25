// Clinic lifecycle:
//
//   new          created from a Shopify webhook / pull, or added by hand
//   in_progress  agreement sent; waiting for the clinic to sign and an admin to approve
//   active       clinic signed AND an admin approved — `activatedAt` is stamped
//   suspended / inactive   set by an admin
//
// `pending` is the old name for "not yet approved"; rows still holding it are
// treated like new / in_progress until prisma/migrate-clinic-status.ts converts them.
// Pure module, safe to import from client components.

export const CLINIC_STATUSES = ["new", "in_progress", "active", "suspended", "inactive"] as const;

/** Statuses of clinics still going through onboarding (shown on Approvals). */
export const ONBOARDING_STATUSES = ["new", "in_progress", "pending"] as const;

export function isOnboarding(status: string): boolean {
  return (ONBOARDING_STATUSES as readonly string[]).includes(status);
}

export const CLINIC_STATUS_LABEL: Record<string, string> = {
  new: "New",
  in_progress: "In progress",
  active: "Active",
  suspended: "Suspended",
  inactive: "Inactive",
  pending: "Pending",
};

export const CLINIC_STATUS_TONE: Record<string, "success" | "warning" | "destructive" | "info" | "muted"> = {
  new: "info",
  in_progress: "warning",
  pending: "warning",
  active: "success",
  suspended: "destructive",
  inactive: "muted",
};

export interface ApprovalState {
  agreement: string;
  agreementAcceptedAt: Date | string | null;
  agreementLocked: boolean;
}

/**
 * True when the clinic itself has signed the current agreement on the consent
 * page. `agreement: "accepted"` alone isn't enough — older Shopify imports and
 * manual edits could set it without a signature.
 */
export function clinicHasSigned(c: ApprovalState): boolean {
  return c.agreement === "accepted" && Boolean(c.agreementAcceptedAt);
}

/** Why an admin can't approve (activate) this clinic yet, or null if they can. */
export function approvalBlocker(c: ApprovalState): string | null {
  if (c.agreementLocked) return null; // approved before — reactivating
  if (!clinicHasSigned(c)) {
    return "The clinic must sign the agreement before it can be approved";
  }
  return null;
}
