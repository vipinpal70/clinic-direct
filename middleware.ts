import { NextResponse, type NextRequest } from "next/server";
import { verifyAccessToken } from "@/lib/jwt";
import { ACCESS_COOKIE } from "@/lib/session-constants";
import { canAccessPath, homeFor } from "@/lib/roles";

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Public clinic portal (intake + consent) — no login required.
  if (pathname.startsWith("/clinic/")) {
    return NextResponse.next();
  }

  const accessToken = req.cookies.get(ACCESS_COOKIE)?.value;
  const payload = accessToken ? await verifyAccessToken(accessToken) : null;
  const isLoggedIn = Boolean(payload);
  const isLoginPage = pathname === "/login";

  if (!isLoggedIn && !isLoginPage) {
    const redirectUrl = new URL("/login", req.nextUrl);
    redirectUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  // Role gating: finance is limited to invoices + their own profile; /audit is
  // admin / super_admin only.
  if (isLoggedIn && !isLoginPage && !canAccessPath(payload!.role, pathname)) {
    return NextResponse.redirect(new URL(homeFor(payload!.role), req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
