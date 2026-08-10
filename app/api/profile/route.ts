import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-utils";

const updateSchema = z.object({
  name: z.string().min(1),
});

export async function GET() {
  try {
    const session = await requireSession();
    const user = await prisma.adminUser.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        twoFaEnabled: true,
        lastLoginAt: true,
      },
    });
    return NextResponse.json({ data: user });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireSession();
    const { name } = updateSchema.parse(await req.json());

    const user = await prisma.adminUser.update({
      where: { id: session.user.id },
      data: { name },
      select: { id: true, name: true, email: true },
    });

    return NextResponse.json({ data: user });
  } catch (error) {
    return handleApiError(error);
  }
}
