import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, ApiError } from "@/lib/api-utils";

interface Params {
  params: Promise<{ code: string }>;
}

// Public — minimal clinic info for the intake page. No session required.
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { code } = await params;
    const clinic = await prisma.clinic.findUnique({
      where: { code: code.toUpperCase() },
    });
    if (!clinic) throw new ApiError(404, "Clinic not found");

    return NextResponse.json({
      data: {
        name: clinic.name,
        code: clinic.code,
        email: clinic.email,
        detailsSubmitted: Boolean(clinic.detailsSubmittedAt),
        bankDetails: clinic.bankDetails ?? {
          accountHolderName: "",
          bankName: "",
          accountNumber: "",
          sortCode: "",
        },
        taxExempt: clinic.taxExempt ?? {
          exemptStatus: false,
          exemptionTypeCode: "",
          exemptionCertificateUrl: "",
          vatId: "",
        },
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
