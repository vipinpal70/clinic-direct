import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError, ApiError } from "@/lib/api-utils";
import { logAudit, ipFromRequest } from "@/lib/audit";

const updateOrderSchema = z.object({
  status: z.enum(["pending", "processing", "fulfilled", "refunded", "cancelled"]).optional(),
  refundAmount: z.number().min(0).optional(),
  notes: z.string().optional(),
});

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    const order = await prisma.order.findUnique({
      where: { id },
      include: { clinic: { select: { name: true, code: true } } },
    });
    if (!order) throw new ApiError(404, "Order not found");
    return NextResponse.json({ data: order });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const input = updateOrderSchema.parse(await req.json());

    const existing = await prisma.order.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "Order not found");

    const order = await prisma.order.update({ where: { id }, data: input });

    if (input.status && input.status !== existing.status) {
      await logAudit({
        userId: session.user.id,
        userEmail: session.user.email ?? "unknown",
        action: "order.status.updated",
        target: order.number,
        prevValue: existing.status,
        newValue: order.status,
        ipAddress: ipFromRequest(req),
      });
    }

    return NextResponse.json({ data: order });
  } catch (error) {
    return handleApiError(error);
  }
}
