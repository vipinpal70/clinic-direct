import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-utils";

export async function GET() {
  try {
    await requireSession();
    const configs = await prisma.integrationConfig.findMany({
      select: { provider: true, active: true, lastSyncAt: true, updatedAt: true },
    });
    return NextResponse.json({ data: configs });
  } catch (error) {
    return handleApiError(error);
  }
}
