import { prisma } from "@/lib/prisma";
import type { ShopifyCustomer, ShopifyOrder } from "@/lib/shopify-transform";

// Shopify Admin API client with on-demand token caching.
//
// Auth uses the `client_credentials` grant (machine-to-machine, no install
// redirect). The returned token is short-lived (~24h), so it is cached — in
// module memory and in `IntegrationConfig(provider:"shopify").config.token` —
// and only re-minted when it is missing or within TOKEN_SAFETY_WINDOW_MS of
// expiry. If SHOPIFY_CLIENT_ID/SECRET are unset but SHOPIFY_ADMIN_API_KEY is,
// that static token is used directly (no minting, no persistence).

const API_VERSION = process.env.SHOPIFY_API_VERSION || "2025-01";
const TOKEN_SAFETY_WINDOW_MS = 60_000;
const MAX_PAGES = 20;
const PAGE_SIZE = "250";

export class ShopifyConfigError extends Error {}
export class ShopifyApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface ShopifyToken {
  accessToken: string;
  scope: string | null;
  obtainedAt: string; // ISO
  expiresAt: string; // ISO
}

interface TokenResponse {
  access_token?: string;
  scope?: string;
  expires_in?: number; // seconds
}

let memoToken: ShopifyToken | null = null;

function shopDomain(): string {
  const url = process.env.SHOPIFY_STORE_URL;
  if (!url) throw new ShopifyConfigError("SHOPIFY_STORE_URL is not set");
  return url.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

function staticKey(): string | null {
  const hasOAuth =
    Boolean(process.env.SHOPIFY_CLIENT_ID) &&
    Boolean(process.env.SHOPIFY_CLIENT_SECRET);
  return !hasOAuth && process.env.SHOPIFY_ADMIN_API_KEY
    ? process.env.SHOPIFY_ADMIN_API_KEY
    : null;
}

export function shopifyConfigured(): boolean {
  const hasOAuth =
    Boolean(process.env.SHOPIFY_CLIENT_ID) &&
    Boolean(process.env.SHOPIFY_CLIENT_SECRET);
  return (
    Boolean(process.env.SHOPIFY_STORE_URL) &&
    (hasOAuth || Boolean(process.env.SHOPIFY_ADMIN_API_KEY))
  );
}

function isFresh(token: ShopifyToken | null): token is ShopifyToken {
  return (
    !!token &&
    new Date(token.expiresAt).getTime() - TOKEN_SAFETY_WINDOW_MS > Date.now()
  );
}

async function readStoredToken(): Promise<ShopifyToken | null> {
  const row = await prisma.integrationConfig.findUnique({
    where: { provider: "shopify" },
  });
  const cfg = (row?.config ?? null) as unknown as { token?: ShopifyToken } | null;
  return cfg?.token ?? null;
}

async function writeStoredToken(token: ShopifyToken): Promise<void> {
  const row = await prisma.integrationConfig.findUnique({
    where: { provider: "shopify" },
  });
  const cfg = ((row?.config as unknown as Record<string, unknown>) ?? {}) as Record<
    string,
    unknown
  >;
  cfg.token = token; // stored plaintext, consistent with the rest of this app
  await prisma.integrationConfig.upsert({
    where: { provider: "shopify" },
    create: { provider: "shopify", config: cfg as never },
    update: { config: cfg as never },
  });
}

async function mintToken(): Promise<ShopifyToken> {
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new ShopifyConfigError(
      "Shopify OAuth is not configured — set SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET (or SHOPIFY_ADMIN_API_KEY)",
    );
  }

  const res = await fetch(`https://${shopDomain()}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new ShopifyApiError(
      res.status,
      `Shopify token request failed (${res.status})${
        detail ? `: ${detail.slice(0, 200)}` : ""
      }`,
    );
  }

  const json = (await res.json()) as TokenResponse;
  if (!json.access_token) {
    throw new ShopifyApiError(502, "Shopify token response had no access_token");
  }

  const now = new Date();
  const ttlSeconds = json.expires_in ?? 86_400;
  return {
    accessToken: json.access_token,
    scope: json.scope ?? null,
    obtainedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlSeconds * 1000).toISOString(),
  };
}

/**
 * Returns a usable Admin API access token. Regenerates via `client_credentials`
 * ONLY when the cached token is missing or about to expire. Pass `force` to
 * discard the cache (used once on a 401).
 */
export async function getAccessToken(force = false): Promise<string> {
  const key = staticKey();
  if (key) return key;

  if (!force && isFresh(memoToken)) return memoToken.accessToken;

  if (!force) {
    const stored = await readStoredToken();
    if (isFresh(stored)) {
      memoToken = stored;
      return stored.accessToken;
    }
  }

  const token = await mintToken();
  memoToken = token;
  await writeStoredToken(token).catch(() => {
    // a persistence failure must not break the pull; memory cache still holds
  });
  return token.accessToken;
}

export type TokenStatus =
  | { state: "none" }
  | { state: "static" }
  | {
      state: "valid" | "expired";
      obtainedAt: string;
      expiresAt: string;
      scope: string | null;
    };

/** Read-only snapshot of the cached token for display — never mints. */
export async function getTokenStatus(): Promise<TokenStatus> {
  if (!shopifyConfigured()) return { state: "none" };
  if (staticKey()) return { state: "static" };

  const token = memoToken ?? (await readStoredToken());
  if (!token) return { state: "none" };
  return {
    state: isFresh(token) ? "valid" : "expired",
    obtainedAt: token.obtainedAt,
    expiresAt: token.expiresAt,
    scope: token.scope,
  };
}

// ─── REST helpers ────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function shopifyGet(path: string, attempt = 0): Promise<Response> {
  const token = await getAccessToken(attempt === 1);
  const res = await fetch(
    `https://${shopDomain()}/admin/api/${API_VERSION}/${path}`,
    { headers: { "X-Shopify-Access-Token": token, Accept: "application/json" } },
  );

  if (res.status === 401 && attempt === 0) return shopifyGet(path, 1);
  if (res.status === 429 && attempt < 4) {
    const retryAfter = Number(res.headers.get("Retry-After"));
    await sleep((Number.isFinite(retryAfter) ? retryAfter : 2) * 1000);
    return shopifyGet(path, attempt + 1);
  }
  return res;
}

function nextPageInfo(link: string | null): string | null {
  if (!link) return null;
  for (const part of link.split(",")) {
    const m = part.match(/<([^>]+)>;\s*rel="next"/);
    if (m) {
      try {
        return new URL(m[1]).searchParams.get("page_info");
      } catch {
        return null;
      }
    }
  }
  return null;
}

async function fetchAllPaged<T>(
  resource: "customers" | "orders",
  query: Record<string, string>,
): Promise<T[]> {
  const out: T[] = [];
  let params = new URLSearchParams({ limit: PAGE_SIZE, ...query });

  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await shopifyGet(`${resource}.json?${params.toString()}`);
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new ShopifyApiError(
        res.status,
        `Shopify ${resource} request failed (${res.status})${
          detail ? `: ${detail.slice(0, 200)}` : ""
        }`,
      );
    }
    const json = (await res.json()) as Record<string, T[]>;
    out.push(...(json[resource] ?? []));

    const pageInfo = nextPageInfo(res.headers.get("Link"));
    if (!pageInfo) break;
    // Shopify forbids other filters alongside page_info.
    params = new URLSearchParams({ limit: PAGE_SIZE, page_info: pageInfo });
    await sleep(500);
  }
  return out;
}

export function fetchAllCustomers(): Promise<ShopifyCustomer[]> {
  return fetchAllPaged<ShopifyCustomer>("customers", {});
}

export function fetchAllOrders(): Promise<ShopifyOrder[]> {
  return fetchAllPaged<ShopifyOrder>("orders", { status: "any" });
}
