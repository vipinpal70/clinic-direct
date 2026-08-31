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
  // Parse the max sequence numerically — a lexical `orderBy` breaks across digit
  // widths (e.g. "…-9999" sorts after "…-10000").
  const rows = await prisma.invoice.findMany({
    where: { number: { startsWith: prefix } },
    select: { number: true },
  });
  const maxSeq = rows.reduce((max, r) => {
    const n = parseInt(r.number.slice(prefix.length), 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, 999);
  return `${prefix}${maxSeq + 1}`;
}

/** Create an invoice, retrying on a number collision from a concurrent run. */
async function createInvoice(
  data: Omit<Prisma.InvoiceUncheckedCreateInput, "number">,
) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.invoice.create({
        data: { ...data, number: await nextInvoiceNumber() },
      });
    } catch (error) {
      const raced =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002";
      if (!raced || attempt === 4) throw error;
    }
  }
  throw new ApiError(500, "Could not allocate an invoice number");
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
      // "Not yet invoiced" must match both an explicit null and an unset field —
      // Prisma's `invoiceId: null` alone excludes documents where the field is
      // absent (as seeded), so we OR in `isSet: false`.
      where: {
        period,
        status: "approved",
        OR: [{ invoiceId: null }, { invoiceId: { isSet: false } }],
      },
    });
    if (commissions.length === 0) {
      throw new ApiError(400, "No approved commissions ready to invoice for this period");
    }

    const byClinic = new Map<string, typeof commissions>();
    for (const c of commissions) {
      if (!c.clinicId) continue;
      byClinic.set(c.clinicId, [...(byClinic.get(c.clinicId) ?? []), c]);
    }

    // Clinics already invoiced for this period — skip so a re-run can't produce
    // a second invoice for the same clinic + period.
    const alreadyInvoiced = new Set(
      (
        await prisma.invoice.findMany({
          where: { periodStart, clinicId: { in: [...byClinic.keys()] } },
          select: { clinicId: true },
        })
      ).map((i) => i.clinicId),
    );

    const created = [];
    const skipped: string[] = [];
    for (const [clinicId, records] of byClinic) {
      if (alreadyInvoiced.has(clinicId)) {
        skipped.push(clinicId);
        continue;
      }

      const commissionTotal = records.reduce((s, r) => s + r.commission, 0);
      const vatTotal = records.reduce((s, r) => s + r.vat, 0);

      const invoice = await createInvoice({
        clinicId,
        commission: commissionTotal,
        vat: vatTotal,
        total: commissionTotal + vatTotal,
        status: "issued",
        periodStart,
        periodEnd,
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
      newValue: `${created.length} invoices${skipped.length ? `, ${skipped.length} skipped` : ""}`,
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json(
      { data: created, ...(skipped.length ? { skipped: skipped.length } : {}) },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
