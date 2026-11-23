import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, handleApiError, requireRole } from "@/lib/api-utils";
import { ADMIN_ROLES } from "@/lib/roles";

const OBJECT_ID = /^[a-f0-9]{24}$/i;

// GET /api/audit/webhook-events/:id — one captured webhook request as a JSON
// file download. Admin / super_admin only, matching the /audit page (middleware
// doesn't cover /api, so the role is enforced here).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireRole(ADMIN_ROLES);

    const { id } = await params;
    if (!OBJECT_ID.test(id)) throw new ApiError(404, "Not found");

    const event = await prisma.webhookEvent.findUnique({ where: { id } });
    if (!event) throw new ApiError(404, "Not found");

    const filename = `webhook-${event.endpoint}-${(event.topic ?? "event").replace(/[^a-z0-9]+/gi, "-")}-${event.id}.json`;
    return new NextResponse(JSON.stringify(event, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
