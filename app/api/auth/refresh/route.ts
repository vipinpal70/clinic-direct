import { NextRequest, NextResponse } from "next/server";
import {
  rotateSession,
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  sessionCookieOptions,
  clearedCookieOptions,
} from "@/lib/session";
import { ACCESS_TOKEN_TTL_SECONDS } from "@/lib/jwt";
import { ApiError, handleApiError } from "@/lib/api-utils";

export async function POST(req: NextRequest) {
  try {
    const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
    if (!refreshToken) throw new ApiError(401, "No active session");

    const result = await rotateSession(refreshToken);
    if (!result) {
      const response = NextResponse.json({ error: "Session expired" }, { status: 401 });
      response.cookies.set(ACCESS_COOKIE, "", clearedCookieOptions());
      response.cookies.set(REFRESH_COOKIE, "", clearedCookieOptions());
      return response;
    }

    const response = NextResponse.json({
      data: { sessionExpiresAt: result.expiresAt.getTime() },
    });
    response.cookies.set(ACCESS_COOKIE, result.accessToken, sessionCookieOptions(ACCESS_TOKEN_TTL_SECONDS));
    response.cookies.set(REFRESH_COOKIE, result.refreshToken, sessionCookieOptions(
      Math.max(1, Math.floor((result.expiresAt.getTime() - Date.now()) / 1000)),
    ));

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
