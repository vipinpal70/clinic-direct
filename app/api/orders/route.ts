import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError, paginationParams } from "@/lib/api-utils";
import { resolveCommissionPct, computeCommission } from "@/lib/commission";

const createOrderSchema = z.object({
  shopifyId: z.string().min(1),
  number: z.string().min(1),
  clinicId: z.string().min(1),
  total: z.number().positive(),
  items: z.number().int().positive().default(1),
  customerName: z.string().optional(),
  customerEmail: z.string().email().optional(),
  lineItems: z.unknown().optional(),
  shopifyCreatedAt: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const { searchParams } = new URL(req.url);
    const clinicId = searchParams.get("clinicId");
    const status = searchParams.get("status");
    const search = searchParams.get("search")?.trim();
    const { page, pageSize, skip, take } = paginationParams(searchParams);

    const where: Prisma.OrderWhereInput = {};
    if (clinicId) where.clinicId = clinicId;
    if (status) where.status = status as Prisma.OrderWhereInput["status"];
    if (search) {
      where.OR = [
        { number: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
        { customerEmail: { contains: search, mode: "insensitive" } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { clinic: { select: { name: true, code: true } } },
        orderBy: { shopifyCreatedAt: "desc" },
        skip,
        take,
      }),
      prisma.order.count({ where }),
    ]);

    return NextResponse.json({
      data: orders,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const input = createOrderSchema.parse(await req.json());

    const commissionPct = await resolveCommissionPct(input.clinicId);
    const commission = computeCommission(input.total, commissionPct);

    const order = await prisma.order.create({
      data: {
        ...input,
        lineItems: input.lineItems as Prisma.InputJsonValue | undefined,
        shopifyCreatedAt: input.shopifyCreatedAt
          ? new Date(input.shopifyCreatedAt)
          : new Date(),
        commissionPct,
        commission,
      },
    });

    return NextResponse.json({ data: order }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
