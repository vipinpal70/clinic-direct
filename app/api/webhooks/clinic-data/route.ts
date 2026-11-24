import { NextRequest, NextResponse } from "next/server";
import { rejectUnauthenticated } from "@/lib/webhook-auth";
import { withWebhookCapture } from "@/lib/webhook-capture";
import { ingestCustomers } from "@/lib/shopify-ingest";
import type { ShopifyCustomer } from "@/lib/shopify-transform";

// POST /api/webhooks/clinic-data
// Ingests Shopify customer(s), bifurcates them into clinic vs client, reduces
// each to the lean reference structure (+ a `tag` field), and upserts every
// record into the `clinics` collection. A customer is a clinic when its `tags`
// contain `clinic` or its `note` has a "Clinic code: …" line (webhook payloads
// can omit `tags`). Each gets a permanent unique `code` (CUST-<shopifyId>); the
// note's code is stored separately as `clinicCode`. No customer is skipped.
//
// The upsert logic is shared with the admin API pull — see lib/shopify-ingest.ts.

function extractCustomers(payload: unknown): ShopifyCustomer[] {
  if (Array.isArray(payload)) return payload as ShopifyCustomer[];
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.customers)) return obj.customers as ShopifyCustomer[];
    if ("id" in obj) return [payload as ShopifyCustomer];
  }
  return [];
}

// Every delivery (accepted or rejected) is captured raw in `webhook_events`
// by withWebhookCapture — see lib/webhook-capture.ts.
export const POST = withWebhookCapture("clinic-data", async (req: NextRequest, rawBody: string) => {
  const rejection = rejectUnauthenticated(req, rawBody, { allowSharedSecret: true });
  if (rejection) return rejection;

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const customers = extractCustomers(payload);
  if (customers.length === 0) {
    return NextResponse.json({ error: "No customers in payload" }, { status: 400 });
  }

  const result = await ingestCustomers(customers, "webhook");

  return NextResponse.json({
    received: true,
    total: result.total,
    clinicsCount: result.clinicsCount,
    clientsCount: result.clientsCount,
    clinics: result.clinics,
    clients: result.clients,
    ...(result.errors.length ? { errors: result.errors } : {}),
  });
});
