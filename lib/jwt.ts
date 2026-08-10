import { SignJWT, jwtVerify } from "jose";

// Edge-safe (jose only, no Prisma) — usable from middleware, route handlers and Server Components.

const secretValue = process.env.JWT_SECRET;
if (!secretValue && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET must be set in production");
}
const secret = new TextEncoder().encode(secretValue ?? "dev-only-insecure-secret-change-me");

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: string;
  name: string;
  sid: string;
  sessionExpiresAt: number;
}

export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  return new SignJWT({ ...payload, type: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secret);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (payload.type !== "access") return null;
    return payload as unknown as AccessTokenPayload;
  } catch {
    return null;
  }
}
