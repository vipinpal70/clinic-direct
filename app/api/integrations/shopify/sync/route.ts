import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError, ApiError } from "@/lib/api-utils";
import { resolveCommissionPct, computeCommission } from "@/lib/commission";
import { logAudit, ipFromRequest } from "@/lib/audit";

interface ShopifyOrder {
  id: number;
  name: string;
  total_price: string;
  customer?: { first_name?: string; last_name?: string; email?: string };
  line_items: unknown[];
  created_at: string;
  note_attributes?: { name: string; value: string }[];
}

/**
 * Manually pulls recent orders from the Shopify Admin API for clinics whose
 * code is present in the order's note attributes / discount code. Requires
 * SHOPIFY_STORE_URL and SHOPIFY_ADMIN_API_KEY to be configured.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const storeUrl = process.env.SHOPIFY_STORE_URL;
    const apiKey = process.env.SHOPIFY_ADMIN_API_KEY;

    if (!storeUrl || !apiKey) {
      throw new ApiError(
        400,
        "Shopify is not configured — set SHOPIFY_STORE_URL and SHOPIFY_ADMIN_API_KEY",
      );
    }

    const res = await fetch(
      `https://${storeUrl}/admin/api/2025-04/orders.json?status=any&limit=50`,
      { headers: { "X-Shopify-Access-Token": apiKey } },
    );
    if (!res.ok) {
      throw new ApiError(502, `Shopify API responded with ${res.status}`);
    }
    const { orders }: { orders: ShopifyOrder[] } = await res.json();

    const clinics = await prisma.clinic.findMany({ where: { status: "active" } });
    let synced = 0;

    for (const o of orders) {
      const codeAttr = o.note_attributes?.find((a) => a.name === "clinic_code");
      const clinic = codeAttr
        ? clinics.find((c) => c.code === codeAttr.value)
        : undefined;
      if (!clinic) continue;

      const total = parseFloat(o.total_price);
      const commissionPct = await resolveCommissionPct(clinic.id);
      const commission = computeCommission(total, commissionPct);

      await prisma.order.upsert({
        where: { shopifyId: String(o.id) },
        create: {
          shopifyId: String(o.id),
          number: o.name,
          clinicId: clinic.id,
          total,
          items: o.line_items.length,
          customerName: [o.customer?.first_name, o.customer?.last_name]
            .filter(Boolean)
            .join(" "),
          customerEmail: o.customer?.email,
          lineItems: o.line_items as never,
          shopifyCreatedAt: new Date(o.created_at),
          commissionPct,
          commission,
        },
        update: { total, commissionPct, commission },
      });
      synced++;
    }

    await prisma.integrationConfig.upsert({
      where: { provider: "shopify" },
      create: { provider: "shopify", config: {}, lastSyncAt: new Date() },
      update: { lastSyncAt: new Date() },
    });

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email ?? "unknown",
      action: "shopify.sync.manual",
      target: "shopify",
      newValue: `${synced} orders synced`,
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ data: { synced } });
  } catch (error) {
    return handleApiError(error);
  }
}
