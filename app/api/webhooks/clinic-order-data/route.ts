import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveCommissionPct, computeCommission } from "@/lib/commission";
import {
  transformOrder,
  type ShopifyOrder,
  type OrderRecord,
} from "@/lib/shopify-transform";

// POST /api/webhooks/clinic-order-data
// Ingests Shopify order(s), reduces each to the lean order structure, and links
// it to a clinic by clinic code. Every order is stored — nothing is skipped.
//
// Sticky clinic code: a customer's first order carries a clinic code; if a later
// order omits it, we reuse that customer's last-used code. A new code overrides.

function guard(req: NextRequest): boolean {
  const secret = process.env.CLINIC_WEBHOOK_SECRET;
  if (!secret) return true;
  return req.headers.get("x-webhook-secret") === secret;
}

function extractOrders(payload: unknown): ShopifyOrder[] {
  if (Array.isArray(payload)) return payload as ShopifyOrder[];
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.orders)) return obj.orders as ShopifyOrder[];
    if ("id" in obj) return [payload as ShopifyOrder];
  }
  return [];
}

// Most recent prior order for this customer that resolved to a clinic — the
// durable (cross-request) source for the sticky clinic code.
async function lastCodeFromDb(email: string | null): Promise<string | null> {
  if (!email) return null;
  const prior = await prisma.order.findFirst({
    where: { customerEmail: email, clinicId: { not: null } },
    orderBy: { shopifyCreatedAt: "desc" },
    include: { clinic: true },
  });
  return prior?.clinic?.code ?? null;
}

async function upsertOrder(record: OrderRecord, code: string | null) {
  let clinicId: string | null = null;
  let commissionPct = 0;
  let commission = 0;

  if (code) {
    const clinic = await prisma.clinic.findUnique({ where: { code } });
    if (clinic) {
      clinicId = clinic.id;
      commissionPct = await resolveCommissionPct(clinic.id);
      commission = computeCommission(record.total, commissionPct);
    }
  }

  await prisma.order.upsert({
    where: { shopifyId: record.shopifyId },
    create: {
      shopifyId: record.shopifyId,
      number: record.number,
      clinicId,
      status: record.status,
      total: record.total,
      items: record.items,
      customerName: record.customerName,
      customerEmail: record.customerEmail,
      lineItems: record.lineItems as never,
      shopifyCreatedAt: record.shopifyCreatedAt,
      commissionPct,
      commission,
    },
    update: {
      status: record.status,
      total: record.total,
      clinicId,
      commissionPct,
      commission,
    },
  });

  return { clinicId, commissionPct, commission };
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

  const rawOrders = extractOrders(payload);
  if (rawOrders.length === 0) {
    return NextResponse.json({ error: "No orders in payload" }, { status: 400 });
  }

  // Process oldest → newest so an earlier code is available to later code-less
  // orders from the same customer within this batch.
  const records = rawOrders
    .map(transformOrder)
    .sort((a, b) => a.shopifyCreatedAt.getTime() - b.shopifyCreatedAt.getTime());

  const lastCodeByEmail = new Map<string, string>();
  let withClinic = 0;
  let withoutClinic = 0;
  const errors: { shopifyId: string; error: string }[] = [];

  for (const record of records) {
    const emailKey = record.customerEmail?.toLowerCase() ?? null;

    // Own code wins and refreshes the sticky map; otherwise fall back to the
    // customer's last-used code (in-batch, then durable DB lookup).
    let code = record.clinicCode;
    if (code && emailKey) {
      lastCodeByEmail.set(emailKey, code);
    } else if (!code && emailKey) {
      code = lastCodeByEmail.get(emailKey) ?? (await lastCodeFromDb(emailKey));
    }

    try {
      const { clinicId } = await upsertOrder(record, code);
      if (clinicId) {
        withClinic++;
        if (emailKey && code) lastCodeByEmail.set(emailKey, code);
      } else {
        withoutClinic++;
      }

      await prisma.webhookLog.create({
        data: {
          provider: "shopify",
          event: "orders/ingest",
          resourceId: record.shopifyId,
          status: "success",
          processedAt: new Date(),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      errors.push({ shopifyId: record.shopifyId, error: message });
      await prisma.webhookLog.create({
        data: {
          provider: "shopify",
          event: "orders/ingest",
          resourceId: record.shopifyId,
          status: "failed",
          error: message,
        },
      });
    }
  }

  return NextResponse.json({
    received: true,
    processed: records.length,
    withClinic,
    withoutClinic,
    ...(errors.length ? { errors } : {}),
  });
}
