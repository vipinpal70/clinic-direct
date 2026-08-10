import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { resolveCommissionPct, computeCommission } from "@/lib/commission";

interface ShopifyOrderPayload {
  id: number;
  name: string;
  total_price: string;
  customer?: { first_name?: string; last_name?: string; email?: string };
  line_items: unknown[];
  created_at: string;
  cancelled_at?: string | null;
  note_attributes?: { name: string; value: string }[];
}

function verifySignature(rawBody: string, signature: string | null, secret: string) {
  if (!signature) return false;
  const digest = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  const a = Buffer.from(digest);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const topic = req.headers.get("x-shopify-topic") ?? "unknown";
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;

  if (secret) {
    const signature = req.headers.get("x-shopify-hmac-sha256");
    if (!verifySignature(rawBody, signature, secret)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let payload: ShopifyOrderPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const resourceId = String(payload.id ?? "unknown");
  const existingLog = await prisma.webhookLog.findFirst({
    where: { provider: "shopify", event: topic, resourceId },
    orderBy: { createdAt: "desc" },
  });

  try {
    await processShopifyOrder(topic, payload);

    if (existingLog) {
      await prisma.webhookLog.update({
        where: { id: existingLog.id },
        data: {
          status: "success",
          attempts: existingLog.attempts + 1,
          processedAt: new Date(),
          error: null,
        },
      });
    } else {
      await prisma.webhookLog.create({
        data: {
          provider: "shopify",
          event: topic,
          resourceId,
          status: "success",
          processedAt: new Date(),
          payload: payload as never,
        },
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (existingLog) {
      await prisma.webhookLog.update({
        where: { id: existingLog.id },
        data: {
          status: "failed",
          attempts: existingLog.attempts + 1,
          error: message,
        },
      });
    } else {
      await prisma.webhookLog.create({
        data: {
          provider: "shopify",
          event: topic,
          resourceId,
          status: "failed",
          error: message,
          payload: payload as never,
        },
      });
    }
    // Acknowledge receipt so Shopify doesn't hammer retries for data errors
    // (e.g. an order with no recognisable clinic code) while still recording the failure.
    return NextResponse.json({ received: true, warning: message });
  }
}

async function processShopifyOrder(topic: string, payload: ShopifyOrderPayload) {
  if (!topic.startsWith("orders/")) return;

  const codeAttr = payload.note_attributes?.find((a) => a.name === "clinic_code");
  if (!codeAttr) throw new Error("No clinic_code note attribute on order");

  const clinic = await prisma.clinic.findUnique({ where: { code: codeAttr.value } });
  if (!clinic) throw new Error(`Unknown clinic code: ${codeAttr.value}`);

  const total = parseFloat(payload.total_price);
  const commissionPct = await resolveCommissionPct(clinic.id);
  const commission = computeCommission(total, commissionPct);
  const status = payload.cancelled_at
    ? "cancelled"
    : topic === "orders/fulfilled"
      ? "fulfilled"
      : topic === "orders/create"
        ? "pending"
        : "processing";

  await prisma.order.upsert({
    where: { shopifyId: String(payload.id) },
    create: {
      shopifyId: String(payload.id),
      number: payload.name,
      clinicId: clinic.id,
      status,
      total,
      items: payload.line_items.length,
      customerName: [payload.customer?.first_name, payload.customer?.last_name]
        .filter(Boolean)
        .join(" "),
      customerEmail: payload.customer?.email,
      lineItems: payload.line_items as never,
      shopifyCreatedAt: new Date(payload.created_at),
      commissionPct,
      commission,
    },
    update: { status, total, commissionPct, commission },
  });
}
