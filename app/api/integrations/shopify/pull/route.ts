import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError, ApiError } from "@/lib/api-utils";
import { logAudit, ipFromRequest } from "@/lib/audit";
import {
  shopifyConfigured,
  fetchAllCustomers,
  fetchAllOrders,
  ShopifyConfigError,
  ShopifyApiError,
} from "@/lib/shopify";
import { ingestCustomers, ingestOrders } from "@/lib/shopify-ingest";

// POST /api/integrations/shopify/pull  { resource?: "customers" | "orders" | "all" }
//
// Admin-triggered direct pull from the Shopify Admin API. Uses the cached
// access token (regenerated only when missing/expired) and runs the pulled
// records through the same ingest path as the inbound webhooks.

const bodySchema = z.object({
  resource: z.enum(["customers", "orders", "all"]).default("all"),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();

    if (!shopifyConfigured()) {
      throw new ApiError(
        400,
        "Shopify is not configured — set SHOPIFY_STORE_URL and SHOPIFY_CLIENT_ID/SHOPIFY_CLIENT_SECRET (or SHOPIFY_ADMIN_API_KEY)",
      );
    }

    const { resource } = bodySchema.parse(await req.json().catch(() => ({})));

    const data: {
      customers?: {
        total: number;
        clinicsCount: number;
        clientsCount: number;
        errors: { code: string; error: string }[];
      };
      orders?: {
        processed: number;
        withClinic: number;
        withoutClinic: number;
        errors: { shopifyId: string; error: string }[];
      };
    } = {};

    if (resource === "customers" || resource === "all") {
      const r = await ingestCustomers(await fetchAllCustomers(), "api");
      data.customers = {
        total: r.total,
        clinicsCount: r.clinicsCount,
        clientsCount: r.clientsCount,
        errors: r.errors,
      };
    }

    if (resource === "orders" || resource === "all") {
      data.orders = await ingestOrders(await fetchAllOrders(), "api");
    }

    await prisma.integrationConfig.upsert({
      where: { provider: "shopify" },
      create: { provider: "shopify", config: {}, lastSyncAt: new Date() },
      update: { lastSyncAt: new Date() },
    });

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email ?? "unknown",
      action: "shopify.pull",
      target: resource,
      newValue: [
        data.customers && `${data.customers.total} customers`,
        data.orders && `${data.orders.processed} orders`,
      ]
        .filter(Boolean)
        .join(", "),
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof ShopifyConfigError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof ShopifyApiError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    return handleApiError(error);
  }
}
