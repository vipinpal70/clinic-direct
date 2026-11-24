import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { displayClinicCode } from "@/lib/utils";
import { requireSession, handleApiError, ApiError } from "@/lib/api-utils";
import { generateInvoicePdf } from "@/lib/invoice-pdf";

export const runtime = "nodejs";

interface Params {
  params: Promise<{ id: string }>;
}

/** Streams the invoice as a downloadable PDF. */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { clinic: { select: { name: true, code: true, clinicCode: true } } },
    });
    if (!invoice) throw new ApiError(404, "Invoice not found");

    const pdf = await generateInvoicePdf(
      { name: invoice.clinic?.name ?? "—", code: displayClinicCode(invoice.clinic) ?? "—" },
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

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.number}.pdf"`,
        "Content-Length": String(pdf.length),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
