import { NextRequest, NextResponse } from "next/server";
import { rejectUnauthenticated } from "@/lib/webhook-auth";
import { withWebhookCapture } from "@/lib/webhook-capture";
import { ingestCustomers, ingestOrders } from "@/lib/shopify-ingest";
import type { ShopifyCustomer, ShopifyOrder } from "@/lib/shopify-transform";

// POST /api/webhooks/shopify — Shopify's own topics, signature-checked.
//   orders/*     → same handling as /api/webhooks/clinic-order-data: link the
//                  order to a clinic by its clinic code and apply that clinic's
//                  commission rate (from its activation date). No shopper
//                  personal data is stored.
//   customers/*  → same as /api/webhooks/clinic-data: store clinics only.
//   anything else is acknowledged and ignored.
// Every delivery is captured in Audit with patient data removed
// (lib/webhook-capture.ts, lib/pii.ts).
export const POST = withWebhookCapture("shopify", async (req: NextRequest, rawBody: string) => {
  const rejection = rejectUnauthenticated(req, rawBody);
  if (rejection) return rejection;

  const topic = req.headers.get("x-shopify-topic") ?? "";

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  if (!payload || typeof payload !== "object" || !("id" in payload)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Shopify retries anything that isn't 2xx, so data problems (e.g. no clinic
  // code) are acknowledged with a warning rather than an error status.
  if (topic.startsWith("orders/")) {
    const result = await ingestOrders([payload as ShopifyOrder], "webhook");
    return NextResponse.json({
      received: true,
      linkedToClinic: result.withClinic === 1,
      ...(result.errors.length ? { warning: result.errors[0].error } : {}),
    });
  }

  if (topic.startsWith("customers/")) {
    const result = await ingestCustomers([payload as ShopifyCustomer], "webhook");
    return NextResponse.json({
      received: true,
      clinicsCount: result.clinicsCount,
      skippedCount: result.skippedCount,
      ...(result.errors.length ? { warning: result.errors[0].error } : {}),
    });
  }

  return NextResponse.json({ received: true, ignored: `Topic ${topic || "(none)"} is not handled` });
});
