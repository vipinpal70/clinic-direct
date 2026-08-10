import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError, ApiError } from "@/lib/api-utils";
import { logAudit, ipFromRequest } from "@/lib/audit";

const credentialsSchema = z.object({
  loginEmail: z.string().email(),
  password: z.string().min(8).optional(),
});

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const { loginEmail, password } = credentialsSchema.parse(await req.json());

    const existing = await prisma.clinic.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "Clinic not found");

    const clinic = await prisma.clinic.update({
      where: { id },
      data: {
        loginEmail,
        loginHash: password ? await bcrypt.hash(password, 12) : undefined,
      },
    });

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email ?? "unknown",
      action: "clinic.credentials.updated",
      target: clinic.name,
      newValue: loginEmail,
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({
      data: { id: clinic.id, loginEmail: clinic.loginEmail },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
