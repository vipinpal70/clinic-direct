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

/** Roles with admin-level access. */
export const ADMIN_ROLES = ["super_admin", "admin"] as const;

/** Paths only ADMIN_ROLES may open (prefix match) — raw webhook data holds customer PII. */
const ADMIN_ONLY = ["/audit"];

/** Where a blocked finance user is sent. */
export const FINANCE_HOME = "/invoices";

const matches = (pathname: string, prefixes: string[]) =>
  prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));

export function isAdminRole(role: string | undefined): boolean {
  return (ADMIN_ROLES as readonly string[]).includes(role ?? "");
}

export function canAccessPath(role: string | undefined, pathname: string): boolean {
  if (matches(pathname, ADMIN_ONLY) && !isAdminRole(role)) return false;
  if (role === "finance") return matches(pathname, FINANCE_ALLOWED);
  return true;
}

/** Landing page for a user who hit a path their role can't open. */
export function homeFor(role: string | undefined): string {
  return role === "finance" ? FINANCE_HOME : "/";
}
