import crypto from "crypto";

/** Random, unguessable id embedded directly in the public agreement link. */
export function generateAgreementId(): string {
  return crypto.randomBytes(24).toString("hex"); // 48 hex chars
}

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export interface AgreementVars {
  clinicName: string;
  commissionPct: number;
  expiry: Date;
  effectiveDate?: Date;
  ref: string;
}

/**
 * Renders the frozen agreement body (summary + clauses) that becomes the
 * snapshot. The public consent page wraps this with brand chrome + the sign
 * section. Mirrors agreement-page-preview.html.
 */
export function renderAgreementSnapshot(vars: AgreementVars): string {
  const effective = vars.effectiveDate ?? new Date();
  const clinic = escapeHtml(vars.clinicName);

  return `
<div class="summary-grid">
  <div class="summary-item">
    <p class="summary-label">Clinic</p>
    <p class="summary-value">${clinic}</p>
  </div>
  <div class="summary-item">
    <p class="summary-label">Commission rate</p>
    <p class="summary-value">${vars.commissionPct}%</p>
  </div>
  <div class="summary-item">
    <p class="summary-label">Effective date</p>
    <p class="summary-value">${dateFmt.format(effective)}</p>
  </div>
  <div class="summary-item">
    <p class="summary-label">Payment terms</p>
    <p class="summary-value">Net 30</p>
  </div>
</div>

<div class="clauses">
  <p class="clause"><span class="clause-num">1.</span><span>Clinic Direct will list ${clinic} on its platform and route qualifying referrals under the commission rate of ${vars.commissionPct}% stated above.</span></p>
  <p class="clause"><span class="clause-num">2.</span><span>Invoices are issued monthly in arrears and are due within the payment terms stated above.</span></p>
  <p class="clause"><span class="clause-num">3.</span><span>Either party may terminate this agreement with 30 days' written notice.</span></p>
  <p class="clause"><span class="clause-num">4.</span><span>This agreement is governed by the laws of the jurisdiction in which Clinic Direct is registered.</span></p>
</div>

<div class="expiry-note">
  <span>This agreement is valid until ${dateFmt.format(vars.expiry)}.</span>
</div>`.trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
