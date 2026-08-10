import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-utils";
import { logAudit, ipFromRequest } from "@/lib/audit";

/** Pushes every "issued" invoice to "pushed" (simulating a send to Orderwise). */
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();

    const result = await prisma.invoice.updateMany({
      where: { status: "issued" },
      data: { status: "pushed", pushedAt: new Date() },
    });

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email ?? "unknown",
      action: "invoice.pushed",
      target: "queued invoices",
      newValue: `${result.count} invoices`,
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ data: { count: result.count } });
  } catch (error) {
    return handleApiError(error);
  }
}
