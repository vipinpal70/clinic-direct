import crypto from "crypto";
import { NextResponse, type NextRequest } from "next/server";

// Authentication for inbound webhooks. Fails closed: with no secret configured
// every request is refused, because these endpoints can change clinic emails
// and commissions.

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/**
 * Keys Shopify may sign with: SHOPIFY_WEBHOOK_SECRET for webhooks created in the
 * store admin (Settings → Notifications → Webhooks), the app's client secret
 * for webhooks an app registered.
 */
function shopifySecrets(): string[] {
  return [process.env.SHOPIFY_WEBHOOK_SECRET, process.env.SHOPIFY_CLIENT_SECRET]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s));
}

/** Shopify HMAC check; null when it can't be checked (no header or no secret). */
export function checkShopifySignature(req: NextRequest, rawBody: string): boolean | null {
  const signature = req.headers.get("x-shopify-hmac-sha256");
  const secrets = shopifySecrets();
  if (!signature || secrets.length === 0) return null;
  return secrets.some((secret) =>
    safeEqual(
      crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64"),
      signature,
    ),
  );
}

/**
 * Returns the rejection to send, or null when the request is authentic.
 * `allowSharedSecret` also accepts CLINIC_WEBHOOK_SECRET in `x-webhook-secret`,
 * for senders other than Shopify.
 */
export function rejectUnauthenticated(
  req: NextRequest,
  rawBody: string,
  { allowSharedSecret = false }: { allowSharedSecret?: boolean } = {},
): NextResponse | null {
  if (checkShopifySignature(req, rawBody) === true) return null;

  const shared = allowSharedSecret ? process.env.CLINIC_WEBHOOK_SECRET?.trim() : undefined;
  const provided = req.headers.get("x-webhook-secret");
  if (shared && provided && safeEqual(provided, shared)) return null;

  if (!shared && shopifySecrets().length === 0) {
    // 503, not 401: the sender isn't at fault, and it stands out in Audit.
    return NextResponse.json(
      { error: "Webhook verification is not configured" },
      { status: 503 },
    );
  }
  return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
}
