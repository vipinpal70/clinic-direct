import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError, ApiError } from "@/lib/api-utils";
import { logAudit, ipFromRequest } from "@/lib/audit";

const updateSchema = z.object({
  status: z.enum(["payable", "approved", "paid", "cancelled"]).optional(),
  notes: z.string().optional(),
});

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const input = updateSchema.parse(await req.json());

    const existing = await prisma.commission.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "Commission record not found");

    const commission = await prisma.commission.update({ where: { id }, data: input });

    if (input.status && input.status !== existing.status) {
      await logAudit({
        userId: session.user.id,
        userEmail: session.user.email ?? "unknown",
        action: "commission.status.updated",
        target: `${commission.period} · ${commission.clinicId}`,
        prevValue: existing.status,
        newValue: commission.status,
        ipAddress: ipFromRequest(req),
      });
    }

    return NextResponse.json({ data: commission });
  } catch (error) {
    return handleApiError(error);
  }
}
