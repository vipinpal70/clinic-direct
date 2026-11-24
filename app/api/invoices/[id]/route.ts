import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError, ApiError } from "@/lib/api-utils";
import { logAudit, ipFromRequest } from "@/lib/audit";

const updateSchema = z.object({
  status: z.enum(["draft", "issued", "pushed", "paid", "voided"]).optional(),
  notes: z.string().optional(),
});

/** Roles permitted to mark an invoice as paid. */
const PAY_ROLES = ["finance"] as const;

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { clinic: { select: { name: true, code: true, clinicCode: true } } },
    });
    if (!invoice) throw new ApiError(404, "Invoice not found");
    return NextResponse.json({ data: invoice });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const input = updateSchema.parse(await req.json());

    const existing = await prisma.invoice.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "Invoice not found");

    // Marking an invoice paid is a protected, finance-only action. Enforced on
    // the server so it can't be bypassed by calling the API directly.
    if (input.status === "paid") {
      if (!PAY_ROLES.includes(session.user.role as (typeof PAY_ROLES)[number])) {
        throw new ApiError(403, "Only finance users can mark invoices as paid");
      }
      // Guard against duplicate / unintended payment updates.
      if (existing.status === "paid") {
        throw new ApiError(409, "Invoice is already marked as paid");
      }
    }

    const invoice = await prisma.invoice.update({
      where: { id },
      data: {
        ...input,
        pushedAt: input.status === "pushed" ? new Date() : undefined,
        paidAt: input.status === "paid" ? new Date() : undefined,
      },
    });

    if (input.status && input.status !== existing.status) {
      await logAudit({
        userId: session.user.id,
        userEmail: session.user.email ?? "unknown",
        action: "invoice.status.updated",
        target: invoice.number,
        prevValue: existing.status,
        newValue: invoice.status,
        ipAddress: ipFromRequest(req),
      });
    }

    return NextResponse.json({ data: invoice });
  } catch (error) {
    return handleApiError(error);
  }
}
