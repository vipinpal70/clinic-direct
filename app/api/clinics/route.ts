import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClinicsWithStats } from "@/lib/stats";
import { requireSession, handleApiError, ApiError } from "@/lib/api-utils";
import { logAudit, ipFromRequest } from "@/lib/audit";

const createClinicSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).toUpperCase(),
  email: z.string().email(),
  phone: z.string().optional(),
  address: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")),
  commissionPct: z.number().min(0).max(100).default(12),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim().toLowerCase();
    const status = searchParams.get("status");

    let clinics = await getClinicsWithStats();

    if (status) {
      clinics = clinics.filter((c) => c.status === status);
    }
    if (search) {
      clinics = clinics.filter(
        (c) =>
          c.name.toLowerCase().includes(search) ||
          c.code.toLowerCase().includes(search) ||
          c.email.toLowerCase().includes(search),
      );
    }

    return NextResponse.json({ data: clinics });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const input = createClinicSchema.parse(body);

    const existing = await prisma.clinic.findUnique({ where: { code: input.code } });
    if (existing) {
      throw new ApiError(409, "A clinic with this code already exists");
    }

    const clinic = await prisma.clinic.create({
      data: {
        ...input,
        website: input.website || undefined,
      },
    });

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email ?? "unknown",
      action: "clinic.created",
      target: clinic.name,
      newValue: clinic.status,
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ data: clinic }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
