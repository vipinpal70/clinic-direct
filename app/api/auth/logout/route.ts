import { NextRequest, NextResponse } from "next/server";
import {
  revokeSessionByRefreshToken,
  getSessionFromCookies,
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearedCookieOptions,
} from "@/lib/session";
import { handleApiError } from "@/lib/api-utils";
import { logAudit, ipFromRequest } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
    const session = await getSessionFromCookies();

    if (refreshToken) await revokeSessionByRefreshToken(refreshToken);

    if (session?.user) {
      await logAudit({
        userId: session.user.id,
        userEmail: session.user.email,
        action: "user.logout",
        target: session.user.email,
        ipAddress: ipFromRequest(req),
      });
    }

    const response = NextResponse.json({ data: { success: true } });
    response.cookies.set(ACCESS_COOKIE, "", clearedCookieOptions());
    response.cookies.set(REFRESH_COOKIE, "", clearedCookieOptions());
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
