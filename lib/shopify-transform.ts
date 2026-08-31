// Pure transformers that reduce raw Shopify API payloads (customers + orders)
// down to the lean fields this admin panel actually stores. No DB access here —
// these are reused by the clinic-data / clinic-order-data webhooks and are safe
// to unit-test or run offline against the LIST CUSTOMERS / LIST ORDERS dumps.

// ─── Shopify payload shapes (only the fields we read) ─────────────

export interface ShopifyAddress {
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  province?: string | null;
  zip?: string | null;
  country?: string | null;
}

export interface ShopifyCustomer {
  id: number | string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  state?: string | null;
  tags?: string | null;
  note?: string | null;
  created_at?: string | null;
  default_address?: ShopifyAddress | null;
  addresses?: ShopifyAddress[] | null;
}

export interface ShopifyNoteAttribute {
  name: string;
  value: string;
}

export interface ShopifyLineItem {
  title?: string | null;
  name?: string | null;
  sku?: string | null;
  quantity?: number | null;
  price?: string | null;
}

export interface ShopifyOrder {
  id: number | string;
  name?: string | null;
  email?: string | null;
  contact_email?: string | null;
  tags?: string | null;
  note_attributes?: ShopifyNoteAttribute[] | null;
  total_price?: string | null;
  financial_status?: string | null;
  fulfillment_status?: string | null;
  cancelled_at?: string | null;
  created_at?: string | null;
  customer?: ShopifyCustomer | null;
  line_items?: ShopifyLineItem[] | null;
}

// ─── Reduced records we persist ───────────────────────────────────

export type ClinicTag = "clinic" | "client";
export type ClinicStatus = "active" | "pending" | "suspended" | "inactive";
export type AgreementStatus = "not_sent" | "sent" | "viewed" | "accepted";
export type OrderStatus =
  | "pending"
  | "processing"
  | "fulfilled"
  | "refunded"
  | "cancelled";

export interface CustomerRecord {
  tag: ClinicTag;
  name: string;
  code: string;
  email: string;
  phone: string | null;
  status: ClinicStatus;
  agreement: AgreementStatus;
  commissionPct: number;
  joined: Date;
  address: string | null;
  loginEmail: string | null;
  loginHash: string | null;
  businessName: string | null;
  vatNumber: string | null;
  shopifyCustomerId: string;
}

export interface OrderRecord {
  shopifyId: string;
  number: string;
  clinicCode: string | null;
  status: OrderStatus;
  total: number;
  items: number;
  customerName: string | null;
  customerEmail: string | null;
  lineItems: { title: string; sku: string; quantity: number; price: string }[];
  shopifyCreatedAt: Date;
}

// ─── Customer helpers ─────────────────────────────────────────────

export interface ParsedNote {
  clinicCode: string | null;
  address: string | null;
  businessName: string | null;
  vatNumber: string | null;
  acceptedTerms: boolean;
}

/**
 * Tolerant "key: value" line parser for the free-text Shopify customer note.
 * Handles both `\r\n` and `\n` line breaks and case-insensitive keys, and the
 * several aliases used for the business name across clinic/client notes.
 */
export function parseCustomerNote(note?: string | null): ParsedNote {
  const result: ParsedNote = {
    clinicCode: null,
    address: null,
    businessName: null,
    vatNumber: null,
    acceptedTerms: false,
  };
  if (!note) return result;

  for (const rawLine of note.split(/\r\n|\r|\n/)) {
    const idx = rawLine.indexOf(":");
    if (idx === -1) continue;
    const key = rawLine.slice(0, idx).trim().toLowerCase();
    const value = rawLine.slice(idx + 1).trim();
    if (!value) continue;

    switch (key) {
      case "clinic code":
        result.clinicCode = value;
        break;
      case "clinic address":
      case "address":
        result.address = value;
        break;
      case "legal business name":
      case "registered business name":
      case "business name":
        result.businessName = value;
        break;
      case "vat number":
        result.vatNumber = value;
        break;
      case "accepted terms of service":
        result.acceptedTerms = value.toLowerCase() === "true";
        break;
    }
  }
  return result;
}

/** Comma-separated Shopify tags → normalised lower-case list. */
export function parseTags(tags?: string | null): string[] {
  if (!tags) return [];
  return tags
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

/** A customer is a clinic when its tags contain `clinic`; otherwise a client. */
export function isClinic(tags?: string | null): boolean {
  return parseTags(tags).includes("clinic");
}

function formatAddress(addr?: ShopifyAddress | null): string | null {
  if (!addr) return null;
  const parts = [
    addr.address1,
    addr.address2,
    addr.city,
    addr.province,
    addr.zip,
    addr.country,
  ]
    .map((p) => (p ?? "").trim())
    .filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

/**
 * Resolves the unique upsert code for a customer. Real clinic codes come from
 * the note; everything else gets a deterministic synthetic code derived from the
 * Shopify customer id so nothing is ever skipped and uniqueness holds.
 */
export function resolveCustomerCode(
  customer: ShopifyCustomer,
  parsed: ParsedNote,
  tag: ClinicTag,
): string {
  const shopifyId = String(customer.id);
  if (tag === "clinic") {
    if (parsed.clinicCode) return parsed.clinicCode.trim().toUpperCase();
    return `CLINIC-${shopifyId}`;
  }
  return `CUST-${shopifyId}`;
}

/** Reduce a raw Shopify customer to the lean record we store, tagged clinic/client. */
export function transformCustomer(customer: ShopifyCustomer): CustomerRecord {
  const parsed = parseCustomerNote(customer.note);
  const tag: ClinicTag = isClinic(customer.tags) ? "clinic" : "client";

  const fullName = [customer.first_name, customer.last_name]
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(" ");
  const name = fullName || parsed.businessName || "Unknown";

  const status: ClinicStatus = customer.state === "enabled" ? "active" : "suspended";
  const agreement: AgreementStatus = parsed.acceptedTerms ? "accepted" : "not_sent";
  const address = parsed.address ?? formatAddress(customer.default_address);
  const joined = customer.created_at ? new Date(customer.created_at) : new Date();

  return {
    tag,
    name,
    code: resolveCustomerCode(customer, parsed, tag),
    email: customer.email ?? "",
    phone: customer.phone ?? null,
    status,
    agreement,
    commissionPct: 12,
    joined,
    address,
    loginEmail: null,
    loginHash: null,
    businessName: parsed.businessName,
    vatNumber: parsed.vatNumber,
    shopifyCustomerId: String(customer.id),
  };
}

// ─── Order helpers ────────────────────────────────────────────────

/**
 * Finds the clinic code attached to an order: first the `clinic_code` note
 * attribute, then a `clinic_id_<code>` entry in the order tags. Returns null
 * when the order carries no clinic code of its own.
 */
export function extractClinicCode(order: ShopifyOrder): string | null {
  const attr = order.note_attributes?.find(
    (a) => a.name?.toLowerCase() === "clinic_code",
  );
  if (attr?.value?.trim()) return attr.value.trim().toUpperCase();

  for (const tag of parseTags(order.tags)) {
    if (tag.startsWith("clinic_id_")) {
      const code = tag.slice("clinic_id_".length).trim();
      if (code) return code.toUpperCase();
    }
  }
  return null;
}

export function deriveOrderStatus(order: ShopifyOrder): OrderStatus {
  if (order.cancelled_at) return "cancelled";
  if (order.financial_status === "refunded") return "refunded";
  if (order.fulfillment_status === "fulfilled") return "fulfilled";
  if (order.financial_status === "paid") return "processing";
  return "pending";
}

/** Reduce a raw Shopify order to the lean record we store. */
export function transformOrder(order: ShopifyOrder): OrderRecord {
  const customer = order.customer ?? undefined;
  const customerName = customer
    ? [customer.first_name, customer.last_name]
        .map((p) => (p ?? "").trim())
        .filter(Boolean)
        .join(" ") || null
    : null;

  const lineItems = (order.line_items ?? []).map((li) => ({
    title: li.title ?? li.name ?? "",
    sku: li.sku ?? "",
    quantity: li.quantity ?? 1,
    price: li.price ?? "0.00",
  }));

  return {
    shopifyId: String(order.id),
    number: order.name ?? String(order.id),
    clinicCode: extractClinicCode(order),
    status: deriveOrderStatus(order),
    total: parseFloat(order.total_price ?? "0") || 0,
    items: order.line_items?.length ?? lineItems.length,
    customerName,
    customerEmail: order.email ?? order.contact_email ?? customer?.email ?? null,
    lineItems,
    shopifyCreatedAt: order.created_at ? new Date(order.created_at) : new Date(),
  };
}
