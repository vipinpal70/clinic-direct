import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError, ApiError } from "@/lib/api-utils";
import { logAudit, ipFromRequest } from "@/lib/audit";

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => c.trim());
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""]));
  });
}

/** Bulk-creates or updates clinics from an uploaded CSV (name, code, email, phone, commissionPct). */
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "No file uploaded");

    const rows = parseCsv(await file.text());
    let created = 0;
    let updated = 0;

    for (const row of rows) {
      if (!row.name || !row.code || !row.email) continue;

      const existing = await prisma.clinic.findUnique({ where: { code: row.code } });
      const data = {
        name: row.name,
        email: row.email,
        phone: row.phone || undefined,
        commissionPct: row.commissionPct ? parseFloat(row.commissionPct) : undefined,
      };

      if (existing) {
        await prisma.clinic.update({ where: { code: row.code }, data });
        updated++;
      } else {
        await prisma.clinic.create({
          data: { ...data, code: row.code, commissionPct: data.commissionPct ?? 12 },
        });
        created++;
      }
    }

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email ?? "unknown",
      action: "clinic.imported",
      target: "clinics.csv",
      newValue: `${created} created, ${updated} updated`,
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ data: { created, updated } });
  } catch (error) {
    return handleApiError(error);
  }
}
