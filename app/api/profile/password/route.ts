import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError, ApiError } from "@/lib/api-utils";
import { logAudit, ipFromRequest } from "@/lib/audit";

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireSession();
    const { currentPassword, newPassword } = passwordSchema.parse(await req.json());

    const user = await prisma.adminUser.findUniqueOrThrow({
      where: { id: session.user.id },
    });

    // Plain-text comparison — passwords are stored unhashed by explicit product decision.
    if (currentPassword !== user.password) {
      throw new ApiError(400, "Current password is incorrect");
    }

    await prisma.adminUser.update({
      where: { id: user.id },
      data: { password: newPassword },
    });

    await logAudit({
      userId: user.id,
      userEmail: user.email,
      action: "user.password.changed",
      target: user.email,
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    return handleApiError(error);
  }
}
