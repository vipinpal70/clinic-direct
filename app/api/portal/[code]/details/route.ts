import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handleApiError, ApiError } from "@/lib/api-utils";
import { logAudit, ipFromRequest } from "@/lib/audit";

const digits = (s: string) => s.replace(/\D/g, "");

const detailsSchema = z.object({
  bankDetails: z.object({
    accountHolderName: z.string().trim().min(1, "Account holder name is required"),
    bankName: z.string().trim().min(1, "Bank name is required"),
    // Accept spaces/dashes; normalise to bare digits.
    accountNumber: z
      .string()
      .transform(digits)
      .refine((v) => /^\d{6,10}$/.test(v), "Account number must be 6–10 digits"),
    // Accept "40 02 50" / "400250" / "40-02-50"; store canonical 40-02-50.
    sortCode: z
      .string()
      .transform(digits)
      .refine((v) => /^\d{6}$/.test(v), "Sort code must be 6 digits (e.g. 40-02-50)")
      .transform((v) => `${v.slice(0, 2)}-${v.slice(2, 4)}-${v.slice(4)}`),
  }),
  taxExempt: z.object({
    exemptStatus: z.boolean(),
    exemptionTypeCode: z.string().trim().optional().default(""),
    exemptionCertificateUrl: z
      .string()
      .trim()
      .url("Enter a valid URL")
      .optional()
      .or(z.literal("")),
    vatId: z.string().trim().optional().default(""),
  }),
});

interface Params {
  params: Promise<{ code: string }>;
}

// Public — clinic submits its bank + tax details (Step 1). No session required.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { code } = await params;
    const clinic = await prisma.clinic.findUnique({
      where: { code: code.toUpperCase() },
    });
    if (!clinic) throw new ApiError(404, "Clinic not found");

    const input = detailsSchema.parse(await req.json());

    // If exempt, require a type code; certificate URL stays optional.
    if (input.taxExempt.exemptStatus && !input.taxExempt.exemptionTypeCode) {
      throw new ApiError(400, "Provide the exemption type code for an exempt clinic");
    }

    await prisma.clinic.update({
      where: { id: clinic.id },
      data: {
        bankDetails: {
          accountHolderName: input.bankDetails.accountHolderName,
          bankName: input.bankDetails.bankName,
          accountNumber: input.bankDetails.accountNumber,
          sortCode: input.bankDetails.sortCode,
        },
        taxExempt: {
          exemptStatus: input.taxExempt.exemptStatus,
          exemptionTypeCode: input.taxExempt.exemptionTypeCode ?? "",
          exemptionCertificateUrl: input.taxExempt.exemptionCertificateUrl || "",
          vatId: input.taxExempt.vatId ?? "",
        },
        detailsSubmittedAt: new Date(),
      },
    });

    await logAudit({
      userEmail: clinic.email,
      action: "clinic.details.submitted",
      target: clinic.name,
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
