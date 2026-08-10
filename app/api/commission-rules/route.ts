import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-utils";
import { logAudit, ipFromRequest } from "@/lib/audit";

const createRuleSchema = z.object({
  scope: z.string().min(1),
  scopeLabel: z.string().min(1),
  basis: z.enum(["percentage", "fixed"]),
  value: z.number().min(0),
  appliesToLabel: z.string().min(1),
  priority: z.number().int().default(0),
  active: z.boolean().default(true),
});

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const { searchParams } = new URL(req.url);
    const active = searchParams.get("active");
    const basis = searchParams.get("basis");

    const rules = await prisma.commissionRule.findMany({
      where: {
        ...(active !== null ? { active: active === "true" } : {}),
        ...(basis ? { basis } : {}),
      },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({ data: rules });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const input = createRuleSchema.parse(await req.json());

    const rule = await prisma.commissionRule.create({ data: input });

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email ?? "unknown",
      action: "commission.rule.created",
      target: rule.scopeLabel,
      newValue: `${rule.value}${rule.basis === "percentage" ? "%" : ""}`,
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ data: rule }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
