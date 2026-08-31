import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  transformCustomer,
  type ShopifyCustomer,
  type CustomerRecord,
} from "@/lib/shopify-transform";

// POST /api/webhooks/clinic-data
// Ingests Shopify customer(s), bifurcates them into clinic vs client by their
// `tags`, reduces each to the lean reference structure (+ a `tag` field), and
// upserts every record into the `clinics` collection. No customer is skipped —
// code-less clinics and all clients get a deterministic synthetic code.

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

async function upsertCustomer(record: CustomerRecord) {
  return prisma.clinic.upsert({
    where: { code: record.code },
    create: {
      name: record.name,
      code: record.code,
      tag: record.tag,
      shopifyCustomerId: record.shopifyCustomerId,
      businessName: record.businessName,
      vatNumber: record.vatNumber,
      email: record.email,
      phone: record.phone,
      status: record.status,
      agreement: record.agreement,
      commissionPct: record.commissionPct,
      joined: record.joined,
      address: record.address,
      loginEmail: record.loginEmail,
      loginHash: record.loginHash,
    },
    // Refresh mutable Shopify-sourced fields; leave admin-managed fields
    // (commissionPct, portal login) untouched on update.
    update: {
      name: record.name,
      tag: record.tag,
      shopifyCustomerId: record.shopifyCustomerId,
      businessName: record.businessName,
      vatNumber: record.vatNumber,
      email: record.email,
      phone: record.phone,
      status: record.status,
      agreement: record.agreement,
      address: record.address,
    },
  });
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

  const clinics: CustomerRecord[] = [];
  const clients: CustomerRecord[] = [];
  const errors: { code: string; error: string }[] = [];

  for (const customer of customers) {
    const record = transformCustomer(customer);
    (record.tag === "clinic" ? clinics : clients).push(record);
    try {
      await upsertCustomer(record);
    } catch (error) {
      errors.push({
        code: record.code,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  const status = errors.length ? "failed" : "success";
  try {
    await prisma.webhookLog.create({
      data: {
        provider: "shopify",
        event: "customers/bifurcate",
        resourceId: `batch-${customers.length}`,
        status,
        processedAt: new Date(),
        error: errors.length ? JSON.stringify(errors) : null,
        payload: payload as never,
      },
    });
  } catch {
    // logging failure must not fail the webhook
  }

  return NextResponse.json({
    received: true,
    total: customers.length,
    clinicsCount: clinics.length,
    clientsCount: clients.length,
    clinics,
    clients,
    ...(errors.length ? { errors } : {}),
  });
}
