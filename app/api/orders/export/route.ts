import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { displayClinicCode } from "@/lib/utils";
import { requireSession, handleApiError } from "@/lib/api-utils";

function csvEscape(value: string | number) {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export async function GET() {
  try {
    await requireSession();
    const orders = await prisma.order.findMany({
      include: { clinic: { select: { name: true, code: true, clinicCode: true } } },
      orderBy: { shopifyCreatedAt: "desc" },
    });

    const header = [
      "number", "clinic", "customer", "items", "total",
      "commission", "status", "date",
    ];
    const rows = orders.map((o) => [
      o.number, displayClinicCode(o.clinic) ?? "", o.customerName ?? "", o.items,
      o.total, o.commission, o.status,
      o.shopifyCreatedAt.toISOString().slice(0, 10),
    ]);

    const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
