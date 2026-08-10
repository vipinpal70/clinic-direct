import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession, ACCESS_COOKIE, REFRESH_COOKIE, sessionCookieOptions, SESSION_TTL_MS } from "@/lib/session";
import { ACCESS_TOKEN_TTL_SECONDS } from "@/lib/jwt";
import { handleApiError, ApiError } from "@/lib/api-utils";
import { logAudit, ipFromRequest } from "@/lib/audit";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const { email, password } = loginSchema.parse(await req.json());

    const user = await prisma.adminUser.findUnique({ where: { email: email.toLowerCase().trim() } });

    // Plain-text comparison — passwords are stored unhashed by explicit product decision.
    if (!user || user.status === "suspended" || user.password !== password) {
      throw new ApiError(401, "Invalid email or password");
    }

    const ipAddress = ipFromRequest(req);
    const { accessToken, refreshToken, expiresAt } = await createSession(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      { userAgent: req.headers.get("user-agent") ?? undefined, ipAddress: ipAddress ?? undefined },
    );

    await prisma.adminUser.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        status: user.status === "invited" ? "active" : user.status,
      },
    });

    await logAudit({
      userId: user.id,
      userEmail: user.email,
      action: "user.login",
      target: user.email,
      ipAddress,
    });

    const response = NextResponse.json({
      data: {
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        sessionExpiresAt: expiresAt.getTime(),
      },
    });

    response.cookies.set(ACCESS_COOKIE, accessToken, sessionCookieOptions(ACCESS_TOKEN_TTL_SECONDS));
    response.cookies.set(REFRESH_COOKIE, refreshToken, sessionCookieOptions(SESSION_TTL_MS / 1000));

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
