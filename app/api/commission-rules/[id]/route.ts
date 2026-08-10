import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError, ApiError } from "@/lib/api-utils";
import { logAudit, ipFromRequest } from "@/lib/audit";

const updateRuleSchema = z.object({
  scopeLabel: z.string().min(1).optional(),
  basis: z.enum(["percentage", "fixed"]).optional(),
  value: z.number().min(0).optional(),
  appliesToLabel: z.string().min(1).optional(),
  priority: z.number().int().optional(),
  active: z.boolean().optional(),
});

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const input = updateRuleSchema.parse(await req.json());

    const existing = await prisma.commissionRule.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "Commission rule not found");

    const rule = await prisma.commissionRule.update({ where: { id }, data: input });

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email ?? "unknown",
      action: "commission.rule.updated",
      target: rule.scopeLabel,
      prevValue: `${existing.value}${existing.basis === "percentage" ? "%" : ""}`,
      newValue: `${rule.value}${rule.basis === "percentage" ? "%" : ""}`,
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ data: rule });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const rule = await prisma.commissionRule.delete({ where: { id } });

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email ?? "unknown",
      action: "commission.rule.deleted",
      target: rule.scopeLabel,
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ data: rule });
  } catch (error) {
    return handleApiError(error);
  }
}
