import crypto from "crypto";

// Patient (shopper) data is not kept. Clinics are stored in full; for everyone
// else we keep only what's needed to link orders to clinics.
// Pure module with no app imports, so one-off scripts can use it too.

/**
 * Stable pseudonymous key for a shopper's email, used only to reuse the clinic
 * code from their earlier order ("sticky" clinic). It is not reversible, but
 * anyone who already knows an email can recompute it, so treat it as personal
 * data too — just not readable.
 */
export function customerKey(email?: string | null): string | null {
  const normalised = (email ?? "").trim().toLowerCase();
  if (!normalised) return null;
  return crypto.createHash("sha256").update(`clinic-direct:customer:${normalised}`).digest("hex");
}

const REDACTED = "[redacted]";

/** Replace every value with a same-type placeholder; keys and shape are kept. */
function blank(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(blank);
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, blank(v)]));
  }
  if (typeof value === "string") return value === "" ? "" : REDACTED;
  if (typeof value === "number") return 0;
  return value; // booleans
}

/** Order fields that describe the shopper rather than the purchase. */
const ORDER_PERSONAL_KEYS = new Set([
  "customer",
  "billing_address",
  "shipping_address",
  "client_details",
  "email",
  "contact_email",
  "phone",
  "browser_ip",
  "note",
  "landing_site",
  "referring_site",
]);

/** Customer fields kept for a patient: nothing that identifies the person. */
const CUSTOMER_SAFE_KEYS = new Set([
  "id",
  "admin_graphql_api_id",
  "created_at",
  "updated_at",
  "state",
  "currency",
  "tax_exempt",
  "verified_email",
]);

function redactOrder(order: unknown): unknown {
  if (!order || typeof order !== "object" || Array.isArray(order)) return order;
  return Object.fromEntries(
    Object.entries(order as Record<string, unknown>).map(([k, v]) => [k, ORDER_PERSONAL_KEYS.has(k) ? blank(v) : v]),
  );
}

/** True when a customer note carries a "Clinic code: X" line with a value. */
function noteHasClinicCode(note: unknown): boolean {
  return typeof note === "string" && /^\s*clinic code\s*:\s*\S/im.test(note);
}

function redactCustomer(customer: unknown): unknown {
  if (!customer || typeof customer !== "object" || Array.isArray(customer)) return customer;
  const c = customer as Record<string, unknown>;
  if (noteHasClinicCode(c.note)) return customer; // a clinic — keep in full
  return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, CUSTOMER_SAFE_KEYS.has(k) ? v : blank(v)]));
}

function eachRecord(payload: unknown, key: "orders" | "customers", fn: (r: unknown) => unknown): unknown {
  if (Array.isArray(payload)) return payload.map(fn);
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj[key])) return { ...obj, [key]: (obj[key] as unknown[]).map(fn) };
    return fn(payload);
  }
  return payload;
}

/**
 * Strip patient data from a webhook payload before it is stored in Audit.
 * Orders keep their purchase details (line items, totals, clinic_code note
 * attributes); customers without a clinic code keep only ids and timestamps.
 * Key names and value types are kept, so "Fields seen" still works.
 */
export function redactWebhookPayload(endpoint: string, topic: string | null | undefined, payload: unknown): unknown {
  const isOrder = endpoint === "clinic-order-data" || (endpoint === "shopify" && (topic ?? "orders/").startsWith("orders/"));
  const isCustomer = endpoint === "clinic-data" || (endpoint === "shopify" && (topic ?? "").startsWith("customers/"));
  if (isOrder) return eachRecord(payload, "orders", redactOrder);
  if (isCustomer) return eachRecord(payload, "customers", redactCustomer);
  return blank(payload); // unknown kind: keep only the shape
}
