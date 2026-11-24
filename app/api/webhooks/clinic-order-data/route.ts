import { NextRequest, NextResponse } from "next/server";
import { rejectUnauthenticated } from "@/lib/webhook-auth";
import { withWebhookCapture } from "@/lib/webhook-capture";
import { ingestOrders } from "@/lib/shopify-ingest";
import type { ShopifyOrder } from "@/lib/shopify-transform";

// POST /api/webhooks/clinic-order-data
// Ingests Shopify order(s), reduces each to the lean order structure, and links
// it to a clinic by clinic code. Every order is stored — nothing is skipped.
//
// Sticky clinic code: a customer's first order carries a clinic code; if a later
// order omits it, we reuse that customer's last-used code. A new code overrides.
//
// The mapping / linking / commission logic is shared with the admin API pull —
// see lib/shopify-ingest.ts.

function extractOrders(payload: unknown): ShopifyOrder[] {
  if (Array.isArray(payload)) return payload as ShopifyOrder[];
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.orders)) return obj.orders as ShopifyOrder[];
    if ("id" in obj) return [payload as ShopifyOrder];
  }
  return [];
}

// Every delivery (accepted or rejected) is captured raw in `webhook_events`
// by withWebhookCapture — see lib/webhook-capture.ts.
export const POST = withWebhookCapture("clinic-order-data", async (req: NextRequest, rawBody: string) => {
  const rejection = rejectUnauthenticated(req, rawBody, { allowSharedSecret: true });
  if (rejection) return rejection;

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const orders = extractOrders(payload);
  if (orders.length === 0) {
    return NextResponse.json({ error: "No orders in payload" }, { status: 400 });
  }

  const result = await ingestOrders(orders, "webhook");

  return NextResponse.json({
    received: true,
    processed: result.processed,
    withClinic: result.withClinic,
    withoutClinic: result.withoutClinic,
    ...(result.errors.length ? { errors: result.errors } : {}),
  });
});
