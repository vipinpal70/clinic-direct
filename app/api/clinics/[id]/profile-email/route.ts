import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError, ApiError } from "@/lib/api-utils";
import { logAudit, ipFromRequest } from "@/lib/audit";
import { sendProfileCompletionEmail } from "@/lib/mailer";

interface Params {
  params: Promise<{ id: string }>;
}

// Admin — manually (re)send the "complete your profile" email to a clinic.
// The first send happens automatically on ingest (see lib/shopify-ingest.ts);
// this is the button for every send after that.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await requireSession();
    const { id } = await params;

    const clinic = await prisma.clinic.findUnique({ where: { id } });
    if (!clinic) throw new ApiError(404, "Clinic not found");
    if (!clinic.email) {
      throw new ApiError(400, "This clinic has no email address on file");
    }

    try {
      await sendProfileCompletionEmail(clinic);
    } catch (error) {
      throw new ApiError(
        502,
        `Failed to send email: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }

    const updated = await prisma.clinic.update({
      where: { id },
      data: {
        emailSentCount: { increment: 1 },
        emailSentAt: new Date(),
      },
    });

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email ?? "unknown",
      action: "clinic.profile-email.sent",
      target: clinic.name,
      newValue: `sent to ${clinic.email} (total ${updated.emailSentCount})`,
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({
      data: {
        emailSentCount: updated.emailSentCount,
        emailSentAt: updated.emailSentAt,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
