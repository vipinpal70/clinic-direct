import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/session";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ data: null }, { status: 401 });

  return NextResponse.json({
    data: { user: session.user, sessionExpiresAt: session.sessionExpiresAt },
  });
}
