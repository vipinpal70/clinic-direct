import crypto from "crypto";

// Signed links for the public clinic intake page (/clinic/details/<code>).
//
// A clinic's code is not a secret, so the link also carries a token:
//   <issuedAt base36>.<HMAC-SHA256(clinic id, email, issuedAt)>
// - bound to the clinic and the email it was issued for, so changing the email
//   invalidates links sent to the old address
// - expires after PORTAL_LINK_DAYS
// - good for one submission: a link issued before the details were last
//   submitted is spent, so changing them takes a fresh link from an admin
// Stateless — nothing is stored. Rotating JWT_SECRET invalidates every link.

export const PORTAL_LINK_DAYS = 30;
const MAX_AGE_MS = PORTAL_LINK_DAYS * 24 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 5 * 60 * 1000;

interface TokenClinic {
  id: string;
  email: string;
}

function sign(clinic: TokenClinic, issuedAt: number): string {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set in production");
  }
  // The prefix keeps these signatures distinct from session tokens, which share the key.
  return crypto
    .createHmac("sha256", secret || "dev-only-insecure-secret-change-me")
    .update(
      JSON.stringify(["clinic-details:v1", clinic.id, clinic.email.trim().toLowerCase(), issuedAt]),
    )
    .digest("base64url");
}

export function createDetailsToken(clinic: TokenClinic, now = Date.now()): string {
  return `${now.toString(36)}.${sign(clinic, now)}`;
}

/** App-relative intake link for a clinic, with a fresh token. */
export function detailsPath(clinic: TokenClinic & { code: string }): string {
  return `/clinic/details/${encodeURIComponent(clinic.code)}?t=${createDetailsToken(clinic)}`;
}

/** When the token was issued, or null if it is forged, expired or for another clinic. */
export function verifyDetailsToken(
  clinic: TokenClinic,
  token: string | null,
  now = Date.now(),
): Date | null {
  const match = /^([0-9a-z]{1,11})\.([A-Za-z0-9_-]{43})$/.exec(token ?? "");
  if (!match) return null;

  const issuedAt = parseInt(match[1], 36);
  if (issuedAt > now + CLOCK_SKEW_MS || now - issuedAt > MAX_AGE_MS) return null;

  const expected = Buffer.from(sign(clinic, issuedAt));
  const actual = Buffer.from(match[2]);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
  return new Date(issuedAt);
}

/** True when details were already submitted since this link was issued. */
export function isLinkSpent(issuedAt: Date, detailsSubmittedAt: Date | null): boolean {
  return detailsSubmittedAt !== null && detailsSubmittedAt >= issuedAt;
}
