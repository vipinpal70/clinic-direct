import { NextResponse } from "next/server";
import { getDatabaseStats } from "@/lib/database-stats";
import { requireSession, handleApiError } from "@/lib/api-utils";

export async function GET() {
  try {
    await requireSession();
    const data = await getDatabaseStats();
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
