import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-utils";

function csvEscape(value: string | number) {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export async function GET() {
  try {
    await requireSession();
    const invoices = await prisma.invoice.findMany({
      include: { clinic: { select: { name: true, code: true } } },
      orderBy: { createdAt: "desc" },
    });

    const header = ["number", "date", "clinic", "commission", "vat", "total", "status"];
    const rows = invoices.map((inv) => [
      inv.number,
      inv.createdAt.toISOString().slice(0, 10),
      inv.clinic.name,
      inv.commission,
      inv.vat,
      inv.total,
      inv.status,
    ]);

    const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="invoices-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
