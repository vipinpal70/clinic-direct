import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError, ApiError } from "@/lib/api-utils";
import { logAudit, ipFromRequest } from "@/lib/audit";

const generateSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/),
});

async function nextInvoiceNumber() {
  const year = new Date().getFullYear();
  const prefix = `SBI-${year}-`;
  const last = await prisma.invoice.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
  });
  const lastSeq = last ? parseInt(last.number.replace(prefix, ""), 10) : 999;
  return `${prefix}${lastSeq + 1}`;
}

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const clinicId = searchParams.get("clinicId");

    const where: Prisma.InvoiceWhereInput = {};
    if (status) where.status = status as Prisma.InvoiceWhereInput["status"];
    if (clinicId) where.clinicId = clinicId;

    const invoices = await prisma.invoice.findMany({
      where,
      include: { clinic: { select: { name: true, code: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: invoices });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Generates one self-billed invoice per clinic from that clinic's approved,
 * not-yet-invoiced commission records for the given period.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const { period } = generateSchema.parse(await req.json());
    const [year, month] = period.split("-").map(Number);
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 1);

    const commissions = await prisma.commission.findMany({
      where: { period, status: "approved", invoiceId: null },
    });
    if (commissions.length === 0) {
      throw new ApiError(400, "No approved commissions ready to invoice for this period");
    }

    const byClinic = new Map<string, typeof commissions>();
    for (const c of commissions) {
      byClinic.set(c.clinicId, [...(byClinic.get(c.clinicId) ?? []), c]);
    }

    const created = [];
    for (const [clinicId, records] of byClinic) {
      const commissionTotal = records.reduce((s, r) => s + r.commission, 0);
      const vatTotal = records.reduce((s, r) => s + r.vat, 0);
      const number = await nextInvoiceNumber();

      const invoice = await prisma.invoice.create({
        data: {
          number,
          clinicId,
          commission: commissionTotal,
          vat: vatTotal,
          total: commissionTotal + vatTotal,
          status: "issued",
          periodStart,
          periodEnd,
        },
      });

      await prisma.commission.updateMany({
        where: { id: { in: records.map((r) => r.id) } },
        data: { invoiceId: invoice.id },
      });

      created.push(invoice);
    }

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email ?? "unknown",
      action: "invoice.generated",
      target: period,
      newValue: `${created.length} invoices`,
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
