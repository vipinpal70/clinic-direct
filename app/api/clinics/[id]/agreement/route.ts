import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError, ApiError } from "@/lib/api-utils";
import { logAudit, ipFromRequest } from "@/lib/audit";
import { generateAgreementId, renderAgreementSnapshot } from "@/lib/agreement";
import { sendAgreementEmail } from "@/lib/mailer";
import { isOnboarding } from "@/lib/clinic-status";

const sendSchema = z.object({
  commissionPct: z.number().min(0).max(100).optional(),
  expiry: z.coerce.date().optional(),
});

interface Params {
  params: Promise<{ id: string }>;
}

// Admin — configure per-clinic variables, freeze the snapshot, and send.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const input = sendSchema.parse(body || {});

    const clinic = await prisma.clinic.findUnique({ where: { id } });
    if (!clinic) throw new ApiError(404, "Clinic not found");
    if (!clinic.email) {
      throw new ApiError(400, "Clinic has no email address on file");
    }
    if (clinic.agreementLocked) {
      throw new ApiError(
        409,
        "This clinic's agreement is approved and locked — it can no longer be edited.",
      );
    }

    const commissionPct = input.commissionPct ?? clinic.commissionPct ?? 12;
    const defaultExpiry = new Date();
    defaultExpiry.setDate(defaultExpiry.getDate() + 7);
    const expiry = input.expiry ?? defaultExpiry;

    if (expiry <= new Date()) {
      throw new ApiError(400, "Expiry date must be in the future");
    }

    const snapshot = renderAgreementSnapshot({
      clinicName: clinic.name,
      commissionPct,
      expiry,
      ref: `CD-${clinic.code}`,
    });
    const agreementId = generateAgreementId();

    const updated = await prisma.clinic.update({
      where: { id },
      data: {
        agreement: "sent",
        // Sending moves an onboarding clinic to in_progress; suspended or
        // inactive clinics keep their status.
        ...(isOnboarding(clinic.status) ? { status: "in_progress" as const } : {}),
        agreementId,
        agreementSnapshot: snapshot,
        agreementCommissionPct: commissionPct,
        agreementExpiry: expiry,
        agreementSentAt: new Date(),
        // Re-sending resets any prior acceptance for a fresh signature.
        agreementAcceptedAt: null,
        agreementSignedName: null,
      },
    });

    const link = `/clinic/consent/${clinic.code}?aid=${agreementId}`;

    // Email the consent link to the clinic. The snapshot is already saved, so an
    // SMTP failure surfaces to the admin without losing the sent agreement.
    let emailed = false;
    let emailError: string | null = null;
    if (clinic.email) {
      try {
        await sendAgreementEmail(clinic, link);
        emailed = true;
      } catch (error) {
        emailError =
          error instanceof Error ? error.message : "Failed to send email";
      }
    } else {
      emailError = "Clinic has no email address on file";
    }

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email ?? "unknown",
      action: "clinic.agreement.sent",
      target: clinic.name,
      newValue: `${input.commissionPct}%${emailed ? ` · emailed ${clinic.email}` : ` · email failed: ${emailError}`}`,
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ data: { ...updated, link, emailed, emailError } });
  } catch (error) {
    return handleApiError(error);
  }
}
