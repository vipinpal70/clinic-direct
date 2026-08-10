import crypto from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { signAccessToken, verifyAccessToken } from "@/lib/jwt";
import { ACCESS_COOKIE, REFRESH_COOKIE, SESSION_TTL_MS } from "@/lib/session-constants";

export { ACCESS_COOKIE, REFRESH_COOKIE, SESSION_TTL_MS };

const isProd = process.env.NODE_ENV === "production";

const baseCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: "lax" as const,
  path: "/",
};

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generateRefreshToken() {
  return crypto.randomBytes(32).toString("base64url");
}

interface SessionUser {
  id: string;
  email: string;
  role: string;
  name: string;
}

async function issueTokensForSession(user: SessionUser, sessionId: string, sessionExpiresAt: Date) {
  const accessToken = await signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    sid: sessionId,
    sessionExpiresAt: sessionExpiresAt.getTime(),
  });
  return accessToken;
}

export async function createSession(
  user: SessionUser,
  meta: { userAgent?: string; ipAddress?: string },
) {
  const refreshToken = generateRefreshToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      refreshTokenHash: hashToken(refreshToken),
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
      expiresAt,
    },
  });

  const accessToken = await issueTokensForSession(user, session.id, expiresAt);
  return { accessToken, refreshToken, expiresAt };
}

/** Verifies + rotates a refresh token, issuing a fresh access token. Absolute expiry never moves. */
export async function rotateSession(refreshToken: string) {
  const tokenHash = hashToken(refreshToken);
  const session = await prisma.session.findUnique({
    where: { refreshTokenHash: tokenHash },
    include: { user: true },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;

  const newRefreshToken = generateRefreshToken();
  await prisma.session.update({
    where: { id: session.id },
    data: { refreshTokenHash: hashToken(newRefreshToken) },
  });

  const accessToken = await issueTokensForSession(
    {
      id: session.user.id,
      email: session.user.email,
      role: session.user.role,
      name: session.user.name,
    },
    session.id,
    session.expiresAt,
  );

  return { accessToken, refreshToken: newRefreshToken, expiresAt: session.expiresAt };
}

export async function revokeSessionByRefreshToken(refreshToken: string) {
  await prisma.session.updateMany({
    where: { refreshTokenHash: hashToken(refreshToken) },
    data: { revokedAt: new Date() },
  });
}

export function sessionCookieOptions(maxAgeSeconds: number) {
  return { ...baseCookieOptions, maxAge: maxAgeSeconds };
}

export function clearedCookieOptions() {
  return { ...baseCookieOptions, maxAge: 0 };
}

/** Reads + verifies the access token from cookies. Edge-safe (no DB hit) — used for most auth checks. */
export async function getSessionFromCookies(): Promise<{ user: SessionUser; sessionExpiresAt: number } | null> {
  const store = await cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value;
  if (!accessToken) return null;

  const payload = await verifyAccessToken(accessToken);
  if (!payload) return null;

  return {
    user: { id: payload.sub, email: payload.email, role: payload.role, name: payload.name },
    sessionExpiresAt: payload.sessionExpiresAt,
  };
}
