import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError, ApiError } from "@/lib/api-utils";
import { logAudit, ipFromRequest } from "@/lib/audit";

const inviteSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["super_admin", "admin", "finance", "support", "read_only"]),
});

export async function GET() {
  try {
    await requireSession();
    const users = await prisma.adminUser.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        twoFaEnabled: true,
        lastLoginAt: true,
        invitedAt: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ data: users });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const input = inviteSchema.parse(await req.json());

    const existing = await prisma.adminUser.findUnique({
      where: { email: input.email.toLowerCase() },
    });
    if (existing) throw new ApiError(409, "A user with this email already exists");

    const tempPassword = crypto.randomBytes(9).toString("base64url");

    const user = await prisma.adminUser.create({
      data: {
        name: input.name,
        email: input.email.toLowerCase(),
        role: input.role,
        password: tempPassword,
        status: "invited",
        invitedAt: new Date(),
        invitedBy: session.user.id,
      },
      select: { id: true, name: true, email: true, role: true, status: true },
    });

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email ?? "unknown",
      action: "user.invited",
      target: user.email,
      newValue: "invited",
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json(
      { data: user, tempPassword },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
