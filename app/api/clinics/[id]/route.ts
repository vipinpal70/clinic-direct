import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClinicWithStats } from "@/lib/stats";
import { requireSession, handleApiError, ApiError } from "@/lib/api-utils";
import { logAudit, ipFromRequest } from "@/lib/audit";

const updateClinicSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")),
  commissionPct: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
  status: z.enum(["active", "pending", "suspended", "inactive"]).optional(),
  agreement: z.enum(["not_sent", "sent", "viewed", "accepted"]).optional(),
});

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    const clinic = await getClinicWithStats(id);
    if (!clinic) throw new ApiError(404, "Clinic not found");
    return NextResponse.json({ data: clinic });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const body = await req.json();
    const input = updateClinicSchema.parse(body);

    const existing = await prisma.clinic.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "Clinic not found");

    if (input.status === "active" && existing.status === "pending") {
      const agreementAfterUpdate = input.agreement ?? existing.agreement;
      if (agreementAfterUpdate !== "accepted") {
        throw new ApiError(
          400,
          "Clinic agreement must be accepted before approval",
        );
      }
    }

    const clinic = await prisma.clinic.update({
      where: { id },
      data: { ...input, website: input.website || undefined },
    });

    if (input.status && input.status !== existing.status) {
      await logAudit({
        userId: session.user.id,
        userEmail: session.user.email ?? "unknown",
        action: "clinic.status.updated",
        target: clinic.name,
        prevValue: existing.status,
        newValue: clinic.status,
        ipAddress: ipFromRequest(req),
      });
    }
    if (input.agreement && input.agreement !== existing.agreement) {
      await logAudit({
        userId: session.user.id,
        userEmail: session.user.email ?? "unknown",
        action: "clinic.agreement.updated",
        target: clinic.name,
        prevValue: existing.agreement,
        newValue: clinic.agreement,
        ipAddress: ipFromRequest(req),
      });
    }

    return NextResponse.json({ data: clinic });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const clinic = await prisma.clinic.delete({ where: { id } });

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email ?? "unknown",
      action: "clinic.deleted",
      target: clinic.name,
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ data: clinic });
  } catch (error) {
    return handleApiError(error);
  }
}
