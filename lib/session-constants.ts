// Edge-safe constants (no Prisma import) — shared by middleware.ts and lib/session.ts.

export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours, absolute cap
