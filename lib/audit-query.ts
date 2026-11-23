import type { Prisma } from "@prisma/client";
import { WEBHOOK_ENDPOINTS, type WebhookEventStatus } from "@/lib/webhook-constants";

// Filters + pagination for the webhook audit (`webhook_events`). Shared by the
// /audit page and GET /api/audit/webhook-events so both accept the same query
// string:
//
//   page       1-based page number                     (default 1)
//   pageSize   rows per page: 25 | 50 | 100 | 200      (default 50)
//   offset     row offset; used when `page` is absent  (page = offset / pageSize + 1)
//   sort       "desc" (newest first, default) | "asc"
//   q          text search: URL, topic, resource / webhook / event id, error
//   method     HTTP method, e.g. POST
//   endpoint   shopify | clinic-data | clinic-order-data
//   topic      X-Shopify-Topic, or "none" for requests without one
//   status     processed | failed | rejected | error | received
//   http       exact code (401), a class (2xx / 4xx / 5xx), or "none"
//   signature  valid | invalid | unchecked
//   from, to   received date range, YYYY-MM-DD, inclusive (server local time)
//
// Invalid values are ignored rather than rejected, so a hand-edited URL never 500s.

export const PAGE_SIZES = [25, 50, 100, 200] as const;
export const DEFAULT_PAGE_SIZE = 50;
export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;
export const EVENT_STATUSES: WebhookEventStatus[] = [
  "processed",
  "failed",
  "rejected",
  "error",
  "received",
];
export const SIGNATURE_FILTERS = ["valid", "invalid", "unchecked"] as const;

export interface AuditFilters {
  q?: string;
  method?: string;
  endpoint?: string;
  topic?: string;
  status?: string;
  http?: string;
  signature?: string;
  from?: string;
  to?: string;
  sort: "asc" | "desc";
}

export interface AuditQuery {
  filters: AuditFilters;
  /** Requested page (before clamping to the last page). */
  page: number;
  pageSize: number;
}

type RawParams = URLSearchParams | Record<string, string | string[] | undefined>;

function getter(params: RawParams) {
  return (key: string): string | undefined => {
    const v = params instanceof URLSearchParams ? params.get(key) : params[key];
    const s = Array.isArray(v) ? v[0] : v;
    const trimmed = s?.trim();
    return trimmed ? trimmed : undefined;
  };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const oneOf = <T extends string>(list: readonly T[], v: string | undefined) =>
  v && (list as readonly string[]).includes(v) ? (v as T) : undefined;

export function parseAuditQuery(params: RawParams): AuditQuery {
  const get = getter(params);

  const sizeRaw = parseInt(get("pageSize") ?? "", 10);
  const pageSize = (PAGE_SIZES as readonly number[]).includes(sizeRaw)
    ? sizeRaw
    : DEFAULT_PAGE_SIZE;

  const pageRaw = parseInt(get("page") ?? "", 10);
  const offsetRaw = parseInt(get("offset") ?? "", 10);
  const page =
    pageRaw >= 1
      ? pageRaw
      : offsetRaw >= 0
        ? Math.floor(offsetRaw / pageSize) + 1
        : 1;

  const http = get("http");
  const from = get("from");
  const to = get("to");

  return {
    page,
    pageSize,
    filters: {
      q: get("q")?.slice(0, 200),
      method: oneOf(HTTP_METHODS, get("method")?.toUpperCase()),
      endpoint: oneOf(WEBHOOK_ENDPOINTS, get("endpoint")),
      topic: get("topic")?.slice(0, 100),
      status: oneOf(EVENT_STATUSES, get("status")),
      http: http && /^([1-5]xx|\d{3}|none)$/.test(http) ? http : undefined,
      signature: oneOf(SIGNATURE_FILTERS, get("signature")),
      from: from && DATE.test(from) ? from : undefined,
      to: to && DATE.test(to) ? to : undefined,
      sort: get("sort") === "asc" ? "asc" : "desc",
    },
  };
}

/** Number of filters narrowing the result (sort excluded). */
export function activeFilterCount(f: AuditFilters): number {
  return [f.q, f.method, f.endpoint, f.topic, f.status, f.http, f.signature, f.from, f.to].filter(
    Boolean,
  ).length;
}

function localDate(value: string, endOfDay: boolean): Date | undefined {
  const d = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  return isNaN(d.getTime()) ? undefined : d;
}

// Prisma omits a field written as `undefined`, so on MongoDB "empty" means
// either explicitly null or not set at all; `{ field: null }` alone misses the latter.
const topicMissing: Prisma.WebhookEventWhereInput = {
  OR: [{ topic: null }, { topic: { isSet: false } }],
};
const signatureMissing: Prisma.WebhookEventWhereInput = {
  OR: [{ signatureValid: null }, { signatureValid: { isSet: false } }],
};
const httpMissing: Prisma.WebhookEventWhereInput = {
  OR: [{ httpStatus: null }, { httpStatus: { isSet: false } }],
};

export function buildAuditWhere(f: AuditFilters): Prisma.WebhookEventWhereInput {
  const and: Prisma.WebhookEventWhereInput[] = [];

  if (f.endpoint) and.push({ endpoint: f.endpoint });
  if (f.status) and.push({ status: f.status });
  if (f.topic) and.push(f.topic === "none" ? topicMissing : { topic: f.topic });

  if (f.method) {
    // Rows captured before `method` was recorded have none; every webhook route
    // only exports POST, so those were POST requests.
    and.push(
      f.method === "POST"
        ? { OR: [{ method: "POST" }, { method: null }, { method: { isSet: false } }] }
        : { method: f.method },
    );
  }

  if (f.http) {
    if (f.http === "none") and.push(httpMissing);
    else if (f.http.endsWith("xx")) {
      const base = Number(f.http[0]) * 100;
      and.push({ httpStatus: { gte: base, lt: base + 100 } });
    } else and.push({ httpStatus: Number(f.http) });
  }

  if (f.signature === "valid") and.push({ signatureValid: true });
  else if (f.signature === "invalid") and.push({ signatureValid: false });
  else if (f.signature === "unchecked") and.push(signatureMissing);

  const gte = f.from ? localDate(f.from, false) : undefined;
  const lte = f.to ? localDate(f.to, true) : undefined;
  if (gte || lte) and.push({ receivedAt: { ...(gte && { gte }), ...(lte && { lte }) } });

  if (f.q) {
    const contains = { contains: f.q, mode: "insensitive" as const };
    and.push({
      OR: [
        { url: contains },
        { topic: contains },
        { resourceId: contains },
        { webhookId: contains },
        { eventId: contains },
        { shopDomain: contains },
        { error: contains },
      ],
    });
  }

  return and.length ? { AND: and } : {};
}

/** Where-clause for one Fields-seen source (endpoint + topic, "none" = no topic). */
export function sourceWhere(endpoint: string, topic: string): Prisma.WebhookEventWhereInput {
  return { AND: [{ endpoint }, topic === "none" ? topicMissing : { topic }] };
}

export interface PageInfo {
  page: number;
  pageSize: number;
  offset: number;
  total: number;
  totalPages: number;
  /** 1-based index of the first / last row on this page (0 when empty). */
  from: number;
  to: number;
  hasPrev: boolean;
  hasNext: boolean;
}

/** Clamp the requested page into range and derive offset and row span. */
export function paginate(total: number, requestedPage: number, pageSize: number): PageInfo {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const offset = (page - 1) * pageSize;
  return {
    page,
    pageSize,
    offset,
    total,
    totalPages,
    from: total === 0 ? 0 : offset + 1,
    to: Math.min(offset + pageSize, total),
    hasPrev: page > 1,
    hasNext: page < totalPages,
  };
}

/** Query-string params for the current filters (+ page size), defaults omitted. */
export function auditParams(q: AuditQuery): Record<string, string | undefined> {
  const { sort, ...rest } = q.filters;
  return {
    ...rest,
    sort: sort === "asc" ? "asc" : undefined,
    pageSize: q.pageSize === DEFAULT_PAGE_SIZE ? undefined : String(q.pageSize),
  };
}
