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
export type ClinicStatus = "new" | "in_progress" | "active" | "suspended" | "inactive" | "pending";
export type AgreementStatus = "not_sent" | "sent" | "viewed" | "accepted";
export type OrderStatus =
  | "pending"
  | "processing"
  | "fulfilled"
  | "refunded"
  | "cancelled";

/**
 * What the clinic/client decision was based on:
 *   "tags" — the payload carried Shopify tags
 *   "note" — the note carried a clinic code
 *   "none" — neither was present, so `client` is only a default and must not
 *            downgrade a row already stored as a clinic
 */
export type TagSource = "tags" | "note" | "none";

export interface CustomerRecord {
  tag: ClinicTag;
  tagSource: TagSource;
  name: string;
  /** Permanent unique id, CUST-<shopifyId>. */
  code: string;
  /** Business code from the note; null when the note has none. */
  clinicCode: string | null;
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

/** True when the Shopify tags contain `clinic`. */
export function isClinic(tags?: string | null): boolean {
  return parseTags(tags).includes("clinic");
}

/** Permanent unique id for a Shopify customer. Same for clinics and clients, so
 * it never changes if a customer is reclassified. */
export function customerCode(shopifyId: string): string {
  return `CUST-${shopifyId}`;
}

/** Ids we mint ourselves (CLINIC-<id> is the older form) — never a business code. */
const RESERVED_CODE = /^(CLINIC|CUST)-\d+$/i;

const PLACEHOLDER_CODES = new Set(["NA", "NONE", "NULL", "NIL", "TBC", "TBA", "UNKNOWN"]);

/**
 * Normalises the free-text note code to the form orders carry (trimmed,
 * upper-cased). Returns null for blanks, placeholders ("N/A", "none"), our own
 * CLINIC-/CUST-<id> ids, and free text that isn't a single code.
 */
export function normaliseClinicCode(value?: string | null): string | null {
  const code = (value ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]{0,63}$/.test(code)) return null;
  if (PLACEHOLDER_CODES.has(code) || RESERVED_CODE.test(code)) return null;
  return code;
}

/**
 * A customer is a clinic when its tags contain `clinic` OR its note carries a
 * clinic code. The note matters because customer webhook payloads can omit
 * `tags` entirely.
 */
export function classifyCustomer(
  customer: ShopifyCustomer,
  noteCode: string | null,
): { tag: ClinicTag; tagSource: TagSource } {
  if (isClinic(customer.tags)) return { tag: "clinic", tagSource: "tags" };
  if (noteCode) return { tag: "clinic", tagSource: "note" };
  const hasTags = customer.tags !== undefined && customer.tags !== null;
  return { tag: "client", tagSource: hasTags ? "tags" : "none" };
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
 * The code older versions derived from an email's local part — only used to
 * recognise rows stored that way: everything before the first
 * `@`, with every run of non-alphanumeric characters (`.`, `+`, etc.) collapsed
 * to `-`, surrounding dashes trimmed, and upper-cased to match our codes.
 * e.g. `vuilive.digital@gmail.com` → `VUILIVE-DIGITAL`. Returns null when the
 * email has no usable local part.
 */
export function codeFromEmail(email?: string | null): string | null {
  if (!email) return null;
  const local = email.split("@")[0] ?? "";
  const code = local
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();
  return code || null;
}

/** Reduce a raw Shopify customer to the lean record we store, tagged clinic/client. */
export function transformCustomer(customer: ShopifyCustomer): CustomerRecord {
  const parsed = parseCustomerNote(customer.note);
  const clinicCode = normaliseClinicCode(parsed.clinicCode);
  const { tag, tagSource } = classifyCustomer(customer, clinicCode);

  const fullName = [customer.first_name, customer.last_name]
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(" ");
  const name = fullName || parsed.businessName || "Unknown";

  // Every Shopify customer starts as `new` with no agreement: a clinic only
  // becomes active by signing on the consent page and being approved by an
  // admin. Shopify's account state and "accepted terms" note are not used.
  const status: ClinicStatus = "new";
  const agreement: AgreementStatus = "not_sent";
  const address = parsed.address ?? formatAddress(customer.default_address);
  const joined = customer.created_at ? new Date(customer.created_at) : new Date();

  return {
    tag,
    tagSource,
    name,
    code: customerCode(String(customer.id)),
    clinicCode,
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
