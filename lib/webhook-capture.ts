import crypto from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Raw capture for inbound webhooks. Wrap a route's POST handler with
// `withWebhookCapture(endpoint, handler)` and every request is stored in
// `webhook_events` BEFORE the handler runs — including ones the handler then
// rejects (bad secret, bad JSON, empty batch). The handler's reply is recorded
// afterwards. Capture is best-effort: a logging failure never changes the
// response the sender gets.

import type { WebhookEndpoint, WebhookEventStatus } from "@/lib/webhook-constants";

export { WEBHOOK_ENDPOINTS } from "@/lib/webhook-constants";
export type { WebhookEndpoint, WebhookEventStatus } from "@/lib/webhook-constants";

/** MongoDB caps a document at 16 MB; keep well clear of it. */
const MAX_PAYLOAD_CHARS = 8_000_000;
/** How much of an unparseable / oversized body to keep. */
const MAX_RAW_PREVIEW = 100_000;
/** Replies larger than this are summarised rather than stored whole. */
const MAX_RESPONSE_CHARS = 50_000;
const MAX_ERROR_CHARS = 4_000;

/** Never persisted verbatim — presence is recorded as "[redacted]". */
const REDACTED_HEADERS = new Set([
  "x-shopify-hmac-sha256",
  "x-webhook-secret",
  "authorization",
  "cookie",
]);
const KEPT_HEADERS = new Set([
  "content-type",
  "content-length",
  "user-agent",
  "x-forwarded-for",
  "x-real-ip",
]);

export function verifyShopifyHmac(
  rawBody: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature) return false;
  const digest = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");
  const a = Buffer.from(digest);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function pickHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (REDACTED_HEADERS.has(k)) out[k] = "[redacted]";
    else if (k.startsWith("x-shopify-") || KEPT_HEADERS.has(k)) out[k] = value;
  });
  return out;
}

const SECRET_QUERY_PARAM = /secret|token|key|signature|hmac|password/i;

/**
 * The URL as the caller addressed it. Behind a reverse proxy `req.url` carries
 * the internal host (e.g. localhost:3009), so prefer the forwarded host/proto.
 * Query values whose names look like credentials are redacted.
 */
function requestUrl(req: NextRequest): string {
  const u = new URL(req.nextUrl.toString());
  const first = (v: string | null) => v?.split(",")[0].trim() || null;
  const host = first(req.headers.get("x-forwarded-host")) ?? first(req.headers.get("host"));
  const proto = first(req.headers.get("x-forwarded-proto"));
  if (host) u.host = host;
  if (proto === "http" || proto === "https") u.protocol = `${proto}:`;
  for (const key of [...u.searchParams.keys()]) {
    if (SECRET_QUERY_PARAM.test(key)) u.searchParams.set(key, "[redacted]");
  }
  return u.toString();
}

function parseDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
}

/** Records in the body: a bare array, `{ customers | orders: [...] }`, or one object. */
function describeBody(payload: unknown): { resourceId?: string; recordCount?: number } {
  if (Array.isArray(payload)) return { recordCount: payload.length };
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    for (const key of ["customers", "orders"]) {
      if (Array.isArray(obj[key])) return { recordCount: (obj[key] as unknown[]).length };
    }
    const id = obj.id ?? obj.admin_graphql_api_id;
    return {
      resourceId: id !== undefined && id !== null ? String(id) : undefined,
      recordCount: 1,
    };
  }
  return {};
}

function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max)}…[truncated]` : value;
}

async function recordReceived(
  endpoint: WebhookEndpoint,
  req: NextRequest,
  rawBody: string,
): Promise<string | null> {
  let payload: unknown;
  let parsed = false;
  try {
    payload = JSON.parse(rawBody);
    parsed = true;
  } catch {
    // stored as rawBody below
  }

  const tooLarge = rawBody.length > MAX_PAYLOAD_CHARS;
  const storeParsed = parsed && !tooLarge;
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  const signature = req.headers.get("x-shopify-hmac-sha256");

  const base = {
    endpoint,
    method: req.method,
    url: requestUrl(req),
    topic: req.headers.get("x-shopify-topic") ?? undefined,
    shopDomain: req.headers.get("x-shopify-shop-domain") ?? undefined,
    webhookId: req.headers.get("x-shopify-webhook-id") ?? undefined,
    eventId: req.headers.get("x-shopify-event-id") ?? undefined,
    apiVersion: req.headers.get("x-shopify-api-version") ?? undefined,
    triggeredAt: parseDate(req.headers.get("x-shopify-triggered-at")),
    headers: pickHeaders(req.headers),
    bodyBytes: Buffer.byteLength(rawBody, "utf8"),
    ...(parsed ? describeBody(payload) : {}),
    signatureValid:
      signature && secret ? verifyShopifyHmac(rawBody, signature, secret) : undefined,
    status: "received" as WebhookEventStatus,
  };

  const rawPreview = truncate(rawBody, MAX_RAW_PREVIEW);

  try {
    const row = await prisma.webhookEvent.create({
      data: storeParsed
        ? { ...base, payload: payload as Prisma.InputJsonValue }
        : { ...base, rawBody: rawPreview },
      select: { id: true },
    });
    return row.id;
  } catch (error) {
    // A parsed body Mongo won't accept as a document (exotic keys, depth) —
    // fall back to keeping the raw text so nothing is lost.
    if (storeParsed) {
      try {
        const row = await prisma.webhookEvent.create({
          data: { ...base, rawBody: rawPreview },
          select: { id: true },
        });
        return row.id;
      } catch {
        // fall through
      }
    }
    console.error(
      `Webhook capture failed for ${endpoint}:`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

function classify(
  httpStatus: number,
  body: Record<string, unknown> | null,
  thrown?: string,
): { status: WebhookEventStatus; error?: string } {
  if (thrown) return { status: "error", error: thrown };
  if (httpStatus >= 500) return { status: "error", error: String(body?.error ?? "Server error") };
  if (httpStatus >= 400) return { status: "rejected", error: String(body?.error ?? `HTTP ${httpStatus}`) };
  if (body?.warning) return { status: "failed", error: String(body.warning) };
  if (Array.isArray(body?.errors) && body.errors.length > 0) {
    return { status: "failed", error: JSON.stringify(body.errors) };
  }
  return { status: "processed" };
}

function summariseResponse(body: Record<string, unknown> | null): Prisma.InputJsonValue | undefined {
  if (!body) return undefined;
  const json = JSON.stringify(body);
  if (json.length <= MAX_RESPONSE_CHARS) return body as Prisma.InputJsonValue;
  // Keep scalar fields, replace arrays/objects with their size.
  const summary: Record<string, unknown> = { _truncated: true };
  for (const [k, v] of Object.entries(body)) {
    if (Array.isArray(v)) summary[k] = `[${v.length} items]`;
    else if (v && typeof v === "object") summary[k] = "[object]";
    else summary[k] = v;
  }
  return summary as Prisma.InputJsonValue;
}

async function recordOutcome(
  id: string | null,
  res: NextResponse,
  startedAt: number,
  thrown?: string,
) {
  if (!id) return;
  try {
    const body = (await res.clone().json().catch(() => null)) as Record<string, unknown> | null;
    const { status, error } = classify(res.status, body, thrown);
    await prisma.webhookEvent.update({
      where: { id },
      data: {
        status,
        httpStatus: res.status,
        response: summariseResponse(body),
        error: error ? truncate(error, MAX_ERROR_CHARS) : undefined,
        durationMs: Date.now() - startedAt,
      },
    });
  } catch (error) {
    console.error(
      "Webhook capture outcome update failed:",
      error instanceof Error ? error.message : error,
    );
  }
}

type WebhookHandler = (req: NextRequest, rawBody: string) => Promise<NextResponse>;

export function withWebhookCapture(endpoint: WebhookEndpoint, handler: WebhookHandler) {
  return async function POST(req: NextRequest): Promise<NextResponse> {
    const startedAt = Date.now();
    const rawBody = await req.text();
    const id = await recordReceived(endpoint, req, rawBody);

    let res: NextResponse;
    try {
      res = await handler(req, rawBody);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`Webhook ${endpoint} handler threw:`, error);
      res = NextResponse.json({ error: "Internal server error" }, { status: 500 });
      await recordOutcome(id, res, startedAt, message);
      return res;
    }

    await recordOutcome(id, res, startedAt);
    return res;
  };
}
