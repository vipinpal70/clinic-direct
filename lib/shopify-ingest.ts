import { prisma } from "@/lib/prisma";
import { orderCommission } from "@/lib/commission";
import { findClinicByCode, isClinicCodeTaken } from "@/lib/clinic-code";
import { sendProfileCompletionEmail } from "@/lib/mailer";
import {
  codeFromEmail,
  transformCustomer,
  transformOrder,
  type ShopifyCustomer,
  type ShopifyOrder,
  type CustomerRecord,
  type OrderRecord,
} from "@/lib/shopify-transform";

// Shared ingest for Shopify customer/order data — used by BOTH the inbound
// webhooks (`/api/webhooks/clinic-data`, `/api/webhooks/clinic-order-data`) and
// the admin-triggered API pull (`/api/integrations/shopify/pull`). Behaviour is
// identical either way; `source` only tags the WebhookLog `event`.

export type IngestSource = "webhook" | "api";

/** Prisma unique-constraint violation — a concurrent webhook + API pull raced us. */
function isUniqueViolation(e: unknown): boolean {
  return (
    !!e &&
    typeof e === "object" &&
    "code" in e &&
    (e as { code?: string }).code === "P2002"
  );
}

// ─── Customers ──────────────────────────────────────────────────

/** A customer that was not stored, by Shopify id only — no personal data. */
export interface SkippedCustomer {
  shopifyCustomerId: string;
  reason: string;
}

export interface CustomerIngestResult {
  total: number;
  clinicsCount: number;
  skippedCount: number;
  clinics: CustomerRecord[];
  skipped: SkippedCustomer[];
  errors: { code: string; error: string }[];
}

/**
 * Only clinics are stored, and a customer is a clinic when its note carries a
 * clinic code. Everyone else (patients, other shoppers) is skipped — unless
 * this Shopify customer is already stored as a clinic, so a note edited later
 * can't freeze an existing clinic's details.
 */
async function shouldStore(record: CustomerRecord): Promise<boolean> {
  if (record.clinicCode) return true;
  const existing = await prisma.clinic.findFirst({
    where: { shopifyCustomerId: record.shopifyCustomerId },
    select: { tag: true },
  });
  return existing?.tag === "clinic";
}

// Find the existing row for this Shopify customer. The stable shopifyCustomerId
// always wins, so re-deliveries and API pulls never spawn a second row.
//
// Clinic codes are free text from the Shopify note, so a matching code alone is
// NOT proof of identity: it only links a row that has no Shopify customer yet
// and has the same email. Otherwise anyone typing an existing clinic's code
// would overwrite that clinic's name and email.
async function findExistingClinic(record: CustomerRecord) {
  const linked = await prisma.clinic.findFirst({
    where: { shopifyCustomerId: record.shopifyCustomerId },
  });
  if (linked) return linked;

  // Unlinked rows: same customer id in the code, or a hand-added / older row
  // holding this clinic's business code (or the email-derived one).
  const codes = [record.code];
  if (record.clinicCode) codes.push(record.clinicCode);
  const emailCode = record.tag === "clinic" ? codeFromEmail(record.email) : null;
  if (emailCode) codes.push(emailCode);

  const email = record.email.trim().toLowerCase();
  const candidates = await prisma.clinic.findMany({ where: { code: { in: codes } } });
  return (
    candidates.find(
      (c) =>
        !c.shopifyCustomerId?.trim() &&
        (c.code === record.code || (email !== "" && c.email.trim().toLowerCase() === email)),
    ) ?? null
  );
}

type ClinicRow = NonNullable<Awaited<ReturnType<typeof findExistingClinic>>>;

/** `codeConflict` is set when the note's clinic code already belongs to another clinic. */
interface UpsertResult {
  row: ClinicRow;
  codeConflict: boolean;
}

// Mutable Shopify-sourced fields. Never touched here: `code` (permanent),
// `status` / `agreement` / `activatedAt` (owned by the send → sign → approve
// flow; Shopify only seeds them on create), commissionPct and portal login.
async function updateClinic(existing: ClinicRow, record: CustomerRecord): Promise<UpsertResult> {
  const codeConflict =
    record.clinicCode !== null && (await isClinicCodeTaken(record.clinicCode, existing.id));

  const row = await prisma.clinic.update({
    where: { id: existing.id },
    data: {
      name: record.name,
      // A note without a code, or with someone else's, keeps what is stored.
      clinicCode: (codeConflict ? null : record.clinicCode) ?? existing.clinicCode,
      // No tags and no clinic code tells us nothing — keep the classification.
      tag: record.tagSource === "none" ? existing.tag : record.tag,
      shopifyCustomerId: existing.shopifyCustomerId?.trim() || record.shopifyCustomerId,
      businessName: record.businessName,
      vatNumber: record.vatNumber,
      email: record.email,
      phone: record.phone,
      address: record.address,
    },
  });
  return { row, codeConflict };
}

// Send the profile-completion email on first ingest and record the send. An SMTP
// failure must never break ingest — we log and move on, leaving the counter at 0
// so the admin can retry from the "Resend" button.
async function sendFirstProfileEmail(clinic: {
  id: string;
  name: string;
  code: string;
  email: string;
  tag: string;
}) {
  if (clinic.tag !== "clinic" || !clinic.email) return;
  try {
    await sendProfileCompletionEmail(clinic);
    await prisma.clinic.update({
      where: { id: clinic.id },
      data: { emailSentCount: 1, emailSentAt: new Date() },
    });
  } catch (error) {
    console.error(
      `Failed to send profile-completion email to clinic ${clinic.code}:`,
      error instanceof Error ? error.message : error,
    );
  }
}

async function upsertCustomer(record: CustomerRecord): Promise<UpsertResult> {
  const existing = await findExistingClinic(record);
  if (existing) return updateClinic(existing, record);

  // Never drop a customer over a clashing clinic code: store them without it
  // and report the clash.
  const codeConflict =
    record.clinicCode !== null && (await isClinicCodeTaken(record.clinicCode));

  let row: ClinicRow;
  try {
    row = await prisma.clinic.create({
      data: {
        name: record.name,
        code: record.code,
        clinicCode: codeConflict ? null : record.clinicCode,
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
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    // A concurrent webhook / pull created this customer between our find and
    // create — re-resolve and update it instead of duplicating.
    const raced = await findExistingClinic(record);
    if (!raced) throw error;
    return updateClinic(raced, record);
  }

  // New clinic → trigger the "complete your profile" email once.
  await sendFirstProfileEmail(row);
  return { row, codeConflict };
}

export async function ingestCustomers(
  raw: ShopifyCustomer[],
  source: IngestSource,
): Promise<CustomerIngestResult> {
  const clinics: CustomerRecord[] = [];
  const skipped: SkippedCustomer[] = [];
  const errors: { code: string; error: string }[] = [];

  for (const customer of raw) {
    const record = transformCustomer(customer);
    const wantedCode = record.clinicCode;
    try {
      if (!(await shouldStore(record))) {
        skipped.push({ shopifyCustomerId: record.shopifyCustomerId, reason: "No clinic code in the customer note" });
        continue;
      }
      // Anything stored here is a clinic, whatever its Shopify tags say.
      record.tag = "clinic";
      const { row, codeConflict } = await upsertCustomer(record);
      // Report what is actually stored, which can differ from the payload.
      record.code = row.code;
      record.clinicCode = row.clinicCode;
      record.status = row.status;
      record.agreement = row.agreement;
      record.tag = row.tag;
      if (codeConflict) {
        errors.push({
          code: row.code,
          error: `Clinic code ${wantedCode} already belongs to another clinic, so it was not saved on ${row.code}`,
        });
      }
    } catch (error) {
      errors.push({
        code: record.code,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
    clinics.push(record);
  }

  try {
    await prisma.webhookLog.create({
      data: {
        provider: "shopify",
        event: source === "webhook" ? "customers/bifurcate" : "customers/sync",
        resourceId: `batch-${raw.length}`,
        status: errors.length ? "failed" : "success",
        processedAt: new Date(),
        error: errors.length ? JSON.stringify(errors) : null,
      },
    });
  } catch {
    // logging failure must not fail the ingest
  }

  return {
    total: raw.length,
    clinicsCount: clinics.length,
    skippedCount: skipped.length,
    clinics,
    skipped,
    errors,
  };
}

// ─── Orders ─────────────────────────────────────────────────────

export interface OrderIngestResult {
  processed: number;
  withClinic: number;
  withoutClinic: number;
  errors: { shopifyId: string; error: string }[];
}

// Most recent prior order for this shopper that resolved to a clinic — the
// durable (cross-request) source for the sticky clinic code.
async function lastCodeFromDb(key: string | null): Promise<string | null> {
  if (!key) return null;
  const prior = await prisma.order.findFirst({
    where: { customerKey: key, clinicId: { not: null } },
    orderBy: { shopifyCreatedAt: "desc" },
    include: { clinic: true },
  });
  return prior?.clinic ? (prior.clinic.clinicCode ?? prior.clinic.code) : null;
}

async function upsertOrder(record: OrderRecord, code: string | null) {
  let clinicId: string | null = null;
  let commissionPct = 0;
  let commission = 0;

  if (code) {
    const clinic = await findClinicByCode(code);
    if (clinic) {
      clinicId = clinic.id;
      // The clinic's rate, but only for orders placed once it was active.
      ({ commissionPct, commission } = await orderCommission(clinic, record.total, record.shopifyCreatedAt));
    }
  }

  const update = {
    status: record.status,
    total: record.total,
    clinicId,
    commissionPct,
    commission,
  };

  try {
    await prisma.order.upsert({
      where: { shopifyId: record.shopifyId },
      create: {
        shopifyId: record.shopifyId,
        number: record.number,
        customerKey: record.customerKey,
        lineItems: record.lineItems as never,
        shopifyCreatedAt: record.shopifyCreatedAt,
        items: record.items,
        ...update,
      },
      update,
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    // Concurrent webhook / pull inserted the same shopifyId — update, don't dup.
    await prisma.order.update({
      where: { shopifyId: record.shopifyId },
      data: update,
    });
  }

  return { clinicId };
}

export async function ingestOrders(
  raw: ShopifyOrder[],
  source: IngestSource,
): Promise<OrderIngestResult> {
  // Process oldest → newest so an earlier code is available to later code-less
  // orders from the same customer within this batch.
  const records = raw
    .map(transformOrder)
    .sort((a, b) => a.shopifyCreatedAt.getTime() - b.shopifyCreatedAt.getTime());

  const event = source === "webhook" ? "orders/ingest" : "orders/sync";
  const lastCodeByCustomer = new Map<string, string>();
  let withClinic = 0;
  let withoutClinic = 0;
  const errors: { shopifyId: string; error: string }[] = [];

  for (const record of records) {
    const emailKey = record.customerKey;

    // Own code wins and refreshes the sticky map; otherwise fall back to the
    // customer's last-used code (in-batch, then durable DB lookup).
    let code = record.clinicCode;
    if (code && emailKey) {
      lastCodeByCustomer.set(emailKey, code);
    } else if (!code && emailKey) {
      code = lastCodeByCustomer.get(emailKey) ?? (await lastCodeFromDb(emailKey));
    }

    try {
      const { clinicId } = await upsertOrder(record, code);
      if (clinicId) {
        withClinic++;
        if (emailKey && code) lastCodeByCustomer.set(emailKey, code);
      } else {
        withoutClinic++;
      }

      await prisma.webhookLog.create({
        data: {
          provider: "shopify",
          event,
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
          event,
          resourceId: record.shopifyId,
          status: "failed",
          error: message,
        },
      });
    }
  }

  return { processed: records.length, withClinic, withoutClinic, errors };
}
