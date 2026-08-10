import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError, ApiError } from "@/lib/api-utils";
import { logAudit, ipFromRequest } from "@/lib/audit";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["super_admin", "admin", "finance", "support", "read_only"]).optional(),
  status: z.enum(["active", "invited", "suspended"]).optional(),
});

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const input = updateSchema.parse(await req.json());

    const existing = await prisma.adminUser.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "User not found");

    const user = await prisma.adminUser.update({
      where: { id },
      data: input,
      select: { id: true, name: true, email: true, role: true, status: true },
    });

    if (input.status && input.status !== existing.status) {
      await logAudit({
        userId: session.user.id,
        userEmail: session.user.email ?? "unknown",
        action: "user.status.updated",
        target: user.email,
        prevValue: existing.status,
        newValue: user.status,
        ipAddress: ipFromRequest(req),
      });
    }
    if (input.role && input.role !== existing.role) {
      await logAudit({
        userId: session.user.id,
        userEmail: session.user.email ?? "unknown",
        action: "user.role.updated",
        target: user.email,
        prevValue: existing.role,
        newValue: user.role,
        ipAddress: ipFromRequest(req),
      });
    }

    return NextResponse.json({ data: user });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const session = await requireSession();
    const { id } = await params;

    if (id === session.user.id) {
      throw new ApiError(400, "You cannot remove your own account");
    }

    const user = await prisma.adminUser.delete({ where: { id } });

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email ?? "unknown",
      action: "user.removed",
      target: user.email,
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ data: { id: user.id } });
  } catch (error) {
    return handleApiError(error);
  }
}
