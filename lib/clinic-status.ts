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

/** Statuses of clinics still going through onboarding. */
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
  detailsSubmittedAt: Date | string | null;
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
    return "Waiting for the clinic to sign the agreement";
  }
  if (!c.detailsSubmittedAt) return "Waiting for the clinic to submit its details";
  return null;
}

/**
 * Where a clinic is in the approval pipeline. Based on what has actually
 * happened, not on `status`: older imports copied status from Shopify.
 *   new       registered, no agreement sent
 *   sent      agreement emailed; clinic still has to sign or submit its details
 *   ready     clinic signed and submitted its details; waiting for an admin
 *   approved  admin approved
 */
export type ApprovalStage = "new" | "sent" | "ready" | "approved";

export const APPROVAL_STAGES: ApprovalStage[] = ["new", "sent", "ready", "approved"];

export const APPROVAL_STAGE_LABEL: Record<ApprovalStage, string> = {
  new: "New",
  sent: "Agreement sent",
  ready: "Ready for approval",
  approved: "Approved",
};

export const APPROVAL_STAGE_TONE: Record<ApprovalStage, "success" | "warning" | "info" | "muted"> = {
  new: "muted",
  sent: "warning",
  ready: "info",
  approved: "success",
};

export function agreementWasSent(c: { agreement: string; agreementSentAt: Date | string | null }): boolean {
  return Boolean(c.agreementSentAt) || c.agreement === "sent" || c.agreement === "viewed";
}

export function approvalStage(
  c: ApprovalState & { agreementSentAt: Date | string | null },
): ApprovalStage {
  if (c.agreementLocked) return "approved";
  if (approvalBlocker(c) === null) return "ready";
  return agreementWasSent(c) || clinicHasSigned(c) ? "sent" : "new";
}

/** Clinics that belong on the Approvals page (not patients, not switched off). */
export function inApprovalPipeline(c: { tag: string | null; status: string; agreementLocked: boolean }): boolean {
  if (c.tag === "client") return false;
  return c.agreementLocked || c.status !== "inactive";
}
