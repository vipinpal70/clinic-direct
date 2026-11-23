import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, requireRole } from "@/lib/api-utils";
import { ADMIN_ROLES } from "@/lib/roles";
import { buildAuditWhere, paginate, parseAuditQuery } from "@/lib/audit-query";

// GET /api/audit/webhook-events — paginated, filterable list of captured
// webhook requests. Admin / super_admin only. Accepts the same query string as
// the /audit page (see lib/audit-query.ts): page, pageSize, offset, sort, q,
// method, endpoint, topic, status, http, signature, from, to.
// Payloads are left out unless `include=payload` is passed (they can be large).
export async function GET(req: NextRequest) {
  try {
    await requireRole(ADMIN_ROLES);

    const { searchParams } = new URL(req.url);
    const query = parseAuditQuery(searchParams);
    const where = buildAuditWhere(query.filters);
    const includePayload = searchParams.get("include") === "payload";

    const total = await prisma.webhookEvent.count({ where });
    const meta = paginate(total, query.page, query.pageSize);

    const data = await prisma.webhookEvent.findMany({
      where,
      orderBy: { receivedAt: query.filters.sort },
      skip: meta.offset,
      take: meta.pageSize,
      ...(includePayload ? {} : { omit: { payload: true, rawBody: true } }),
    });

    return NextResponse.json({ data, meta, filters: query.filters });
  } catch (error) {
    return handleApiError(error);
  }
}
