import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handleApiError, ApiError } from "@/lib/api-utils";
import { logAudit, ipFromRequest } from "@/lib/audit";

interface Params {
  params: Promise<{ code: string }>;
}

function loadClinicByAgreement(code: string, agreementId: string | null) {
  if (!agreementId) return null;
  return prisma.clinic.findFirst({
    where: { code: code.toUpperCase(), agreementId },
  });
}

// Public — verify the agreement link and return the frozen snapshot to render.
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { code } = await params;
    const agreementId = req.nextUrl.searchParams.get("aid");
    const clinic = await loadClinicByAgreement(code, agreementId);

    if (!clinic || !clinic.agreementSnapshot) {
      throw new ApiError(400, "This link is invalid.");
    }

    const expired =
      clinic.agreementExpiry != null && clinic.agreementExpiry < new Date();

    // First open moves "sent" → "viewed" (never downgrades an accepted one).
    if (clinic.agreement === "sent" && !expired) {
      await prisma.clinic.update({
        where: { id: clinic.id },
        data: { agreement: "viewed" },
      });
    }

    return NextResponse.json({
      data: {
        clinicName: clinic.name,
        commissionPct: clinic.agreementCommissionPct,
        expiry: clinic.agreementExpiry,
        html: clinic.agreementSnapshot,
        ref: `CD-${clinic.code}`,
        expired,
        accepted: clinic.agreement === "accepted",
        signedName: clinic.agreementSignedName,
        acceptedAt: clinic.agreementAcceptedAt,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

const acceptSchema = z.object({
  aid: z.string().min(1),
  signedName: z.string().trim().min(1, "Enter your name to sign"),
});

// Public — clinic signs and accepts (Step 2). No session required.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { code } = await params;
    const input = acceptSchema.parse(await req.json());
    const clinic = await loadClinicByAgreement(code, input.aid);

    if (!clinic || !clinic.agreementSnapshot) {
      throw new ApiError(400, "This link is invalid.");
    }
    if (clinic.agreementExpiry && clinic.agreementExpiry < new Date()) {
      throw new ApiError(400, "This agreement link has expired.");
    }
    if (clinic.agreement === "accepted") {
      throw new ApiError(400, "This agreement has already been accepted.");
    }

    await prisma.clinic.update({
      where: { id: clinic.id },
      data: {
        agreement: "accepted",
        agreementAcceptedAt: new Date(),
        agreementSignedName: input.signedName,
      },
    });

    await logAudit({
      userEmail: clinic.email,
      action: "clinic.agreement.accepted",
      target: clinic.name,
      newValue: input.signedName,
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
