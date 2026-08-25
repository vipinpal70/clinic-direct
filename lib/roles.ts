// Central role → allowed-path rules. Finance is deliberately narrow: they may
// only reach Self-billed invoices and their own profile. Everyone else keeps
// full navigation. Used by both middleware (redirects) and the sidebar (nav).

export type Role =
  | "super_admin"
  | "admin"
  | "finance"
  | "support"
  | "read_only";

/** Paths a finance user is allowed to open (prefix match). */
const FINANCE_ALLOWED = ["/invoices", "/profile"];

/** Where a blocked user is sent. */
export const FINANCE_HOME = "/invoices";

export function canAccessPath(role: string | undefined, pathname: string): boolean {
  if (role === "finance") {
    return FINANCE_ALLOWED.some(
      (p) => pathname === p || pathname.startsWith(p + "/"),
    );
  }
  return true;
}
