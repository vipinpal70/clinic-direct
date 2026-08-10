import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-utils";
import { resolveCommissionPct, computeCommission } from "@/lib/commission";
import { logAudit, ipFromRequest } from "@/lib/audit";

const runSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/),
});

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period");
    const status = searchParams.get("status");
    const clinicId = searchParams.get("clinicId");

    const where: Prisma.CommissionWhereInput = {};
    if (period) where.period = period;
    if (status) where.status = status as Prisma.CommissionWhereInput["status"];
    if (clinicId) where.clinicId = clinicId;

    const commissions = await prisma.commission.findMany({
      where,
      include: { clinic: { select: { name: true, code: true } } },
      orderBy: [{ period: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ data: commissions });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Runs the commission calculation for a billing period: for every active
 * clinic, sums orders placed that month and upserts a Commission record.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const { period } = runSchema.parse(await req.json());

    const [year, month] = period.split("-").map(Number);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    const clinics = await prisma.clinic.findMany({ where: { status: "active" } });
    const results = [];

    for (const clinic of clinics) {
      const orders = await prisma.order.findMany({
        where: {
          clinicId: clinic.id,
          shopifyCreatedAt: { gte: start, lt: end },
          status: { notIn: ["cancelled"] },
        },
      });
      if (orders.length === 0) continue;

      const gross = orders.reduce((sum, o) => sum + o.total, 0);
      const rate = await resolveCommissionPct(clinic.id);
      const commission = computeCommission(gross, rate);
      const vat = Math.round(commission * 0.2 * 100) / 100;

      const existing = await prisma.commission.findFirst({
        where: { clinicId: clinic.id, period },
      });

      const record = existing
        ? await prisma.commission.update({
            where: { id: existing.id },
            data: { gross, commission, rate, vat },
          })
        : await prisma.commission.create({
            data: { clinicId: clinic.id, period, gross, commission, rate, vat },
          });

      results.push(record);
    }

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email ?? "unknown",
      action: "commission.run.completed",
      target: period,
      newValue: `${results.length} clinics`,
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ data: results }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
