import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError, ApiError } from "@/lib/api-utils";
import { sendInvoiceEmail } from "@/lib/mailer";
import { logAudit, ipFromRequest } from "@/lib/audit";

export const runtime = "nodejs";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * Emails the generated invoice to the clinic's registered email address.
 * Does NOT modify the invoice's payment status.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await requireSession();
    const { id } = await params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { clinic: { select: { name: true, code: true, email: true } } },
    });
    if (!invoice) throw new ApiError(404, "Invoice not found");
    if (!invoice.clinic) {
      throw new ApiError(400, "This invoice is not linked to a clinic");
    }

    const email = invoice.clinic.email?.trim();
    if (!email) {
      throw new ApiError(
        400,
        "The clinic does not have a valid email address on file",
      );
    }

    try {
      await sendInvoiceEmail(
        { name: invoice.clinic.name, code: invoice.clinic.code, email },
        {
          number: invoice.number,
          commission: invoice.commission,
          vat: invoice.vat,
          total: invoice.total,
          status: invoice.status,
          periodStart: invoice.periodStart,
          periodEnd: invoice.periodEnd,
          createdAt: invoice.createdAt,
        },
      );
    } catch (mailError) {
      console.error("Invoice email delivery failed:", mailError);
      throw new ApiError(502, "Failed to send invoice email. Please try again.");
    }

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email ?? "unknown",
      action: "invoice.emailed",
      target: invoice.number,
      newValue: email,
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ success: true, recipient: email });
  } catch (error) {
    return handleApiError(error);
  }
}
