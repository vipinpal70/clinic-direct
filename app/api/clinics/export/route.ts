import { NextResponse } from "next/server";
import { getClinicsWithStats } from "@/lib/stats";
import { requireSession, handleApiError } from "@/lib/api-utils";

function csvEscape(value: string | number) {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export async function GET() {
  try {
    await requireSession();
    const clinics = await getClinicsWithStats();

    const header = [
      "name", "code", "email", "phone", "status", "agreement",
      "commissionPct", "ordersMtd", "monthSales", "totalCommission", "joined",
    ];
    const rows = clinics.map((c) => [
      c.name, c.code, c.email, c.phone ?? "", c.status, c.agreement,
      c.commissionPct, c.ordersMtd, c.monthSales, c.totalCommission,
      c.joined.toISOString().slice(0, 10),
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map(csvEscape).join(","))
      .join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="clinics-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
