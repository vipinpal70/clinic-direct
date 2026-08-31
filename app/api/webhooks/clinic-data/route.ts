import { NextRequest, NextResponse } from "next/server";
import { ingestCustomers } from "@/lib/shopify-ingest";
import type { ShopifyCustomer } from "@/lib/shopify-transform";

// POST /api/webhooks/clinic-data
// Ingests Shopify customer(s), bifurcates them into clinic vs client by their
// `tags`, reduces each to the lean reference structure (+ a `tag` field), and
// upserts every record into the `clinics` collection. No customer is skipped —
// code-less clinics and all clients get a deterministic synthetic code.
//
// The upsert logic is shared with the admin API pull — see lib/shopify-ingest.ts.

// Optional shared-secret guard, mirroring the shopify webhook's secret pattern.
function guard(req: NextRequest): boolean {
  const secret = process.env.CLINIC_WEBHOOK_SECRET;
  if (!secret) return true;
  return req.headers.get("x-webhook-secret") === secret;
}

function extractCustomers(payload: unknown): ShopifyCustomer[] {
  if (Array.isArray(payload)) return payload as ShopifyCustomer[];
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.customers)) return obj.customers as ShopifyCustomer[];
    if ("id" in obj) return [payload as ShopifyCustomer];
  }
  return [];
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!guard(req)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

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
}
