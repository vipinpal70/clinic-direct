import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handleApiError, ApiError } from "@/lib/api-utils";
import { logAudit, ipFromRequest } from "@/lib/audit";
import { isLinkSpent, verifyDetailsToken } from "@/lib/portal-token";

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
  // Only the VAT number is collected; exemption fields are no longer asked for
  // (and are ignored if an already-open older page still sends them).
  taxExempt: z.object({
    vatId: z.string().trim().optional().default(""),
  }),
});

interface Params {
  params: Promise<{ code: string }>;
}

// Public — clinic submits its bank + tax details (Step 1). No session, but the
// signed link token is required and each link allows one submission
// (see lib/portal-token.ts).
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { code } = await params;
    const clinic = await prisma.clinic.findUnique({
      where: { code: code.toUpperCase() },
    });
    const issuedAt = clinic && verifyDetailsToken(clinic, req.headers.get("x-portal-token"));
    if (!clinic || !issuedAt) {
      throw new ApiError(404, "This link is invalid or has expired.");
    }
    const alreadySubmitted = () =>
      new ApiError(
        409,
        "Details have already been submitted with this link. Please contact Clinic Direct to change them.",
      );
    if (isLinkSpent(issuedAt, clinic.detailsSubmittedAt)) throw alreadySubmitted();

    const input = detailsSchema.parse(await req.json());

    // Re-check "not spent" in the write itself so two submissions racing on the
    // same link can't both land.
    const { count } = await prisma.clinic.updateMany({
      where: {
        id: clinic.id,
        OR: [
          { detailsSubmittedAt: null },
          { detailsSubmittedAt: { isSet: false } },
          { detailsSubmittedAt: { lt: issuedAt } },
        ],
      },
      data: {
        bankDetails: {
          accountHolderName: input.bankDetails.accountHolderName,
          bankName: input.bankDetails.bankName,
          accountNumber: input.bankDetails.accountNumber,
          sortCode: input.bankDetails.sortCode,
        },
        taxExempt: { vatId: input.taxExempt.vatId },
        detailsSubmittedAt: new Date(),
      },
    });

    if (count === 0) throw alreadySubmitted();

    await logAudit({
      userEmail: clinic.email,
      action: clinic.detailsSubmittedAt ? "clinic.details.changed" : "clinic.details.submitted",
      target: clinic.name,
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
