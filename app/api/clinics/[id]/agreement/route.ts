import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError, ApiError } from "@/lib/api-utils";
import { logAudit, ipFromRequest } from "@/lib/audit";
import { generateAgreementId, renderAgreementSnapshot } from "@/lib/agreement";

const sendSchema = z.object({
  commissionPct: z.number().min(0).max(100),
  expiry: z.coerce.date(),
});

interface Params {
  params: Promise<{ id: string }>;
}

// Admin — configure per-clinic variables, freeze the snapshot, and send.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const input = sendSchema.parse(await req.json());

    const clinic = await prisma.clinic.findUnique({ where: { id } });
    if (!clinic) throw new ApiError(404, "Clinic not found");
    if (clinic.agreementLocked) {
      throw new ApiError(
        409,
        "This clinic's agreement is approved and locked — it can no longer be edited.",
      );
    }
    if (input.expiry <= new Date()) {
      throw new ApiError(400, "Expiry date must be in the future");
    }

    const snapshot = renderAgreementSnapshot({
      clinicName: clinic.name,
      commissionPct: input.commissionPct,
      expiry: input.expiry,
      ref: `CD-${clinic.code}`,
    });
    const agreementId = generateAgreementId();

    const updated = await prisma.clinic.update({
      where: { id },
      data: {
        agreement: "sent",
        agreementId,
        agreementSnapshot: snapshot,
        agreementCommissionPct: input.commissionPct,
        agreementExpiry: input.expiry,
        agreementSentAt: new Date(),
        // Re-sending resets any prior acceptance for a fresh signature.
        agreementAcceptedAt: null,
        agreementSignedName: null,
      },
    });

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email ?? "unknown",
      action: "clinic.agreement.sent",
      target: clinic.name,
      newValue: `${input.commissionPct}%`,
      ipAddress: ipFromRequest(req),
    });

    const link = `/clinic/consent/${clinic.code}?aid=${agreementId}`;
    return NextResponse.json({ data: { ...updated, link } });
  } catch (error) {
    return handleApiError(error);
  }
}
