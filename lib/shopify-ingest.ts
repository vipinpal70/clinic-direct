import { prisma } from "@/lib/prisma";
import { resolveCommissionPct, computeCommission } from "@/lib/commission";
import {
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

/** Synthetic codes minted when Shopify gives us no real clinic code. */
const FALLBACK_CODE = /^(CLINIC|CUST)-/i;
const isFallbackCode = (code: string) => FALLBACK_CODE.test(code);

// ─── Customers ──────────────────────────────────────────────────

export interface CustomerIngestResult {
  total: number;
  clinicsCount: number;
  clientsCount: number;
  clinics: CustomerRecord[];
  clients: CustomerRecord[];
  errors: { code: string; error: string }[];
}

// Find the existing clinic row for this Shopify customer: the stable
// shopifyCustomerId wins, then the (mutable) code. This is what stops a
// customer whose note code appears / disappears / changes between a webhook
// and an API pull from spawning a second CLINIC-<id> row.
function findExistingClinic(record: CustomerRecord) {
  return prisma.clinic.findFirst({
    where: {
      OR: [
        { shopifyCustomerId: record.shopifyCustomerId },
        { code: record.code },
      ],
    },
  });
}

type ClinicRow = NonNullable<Awaited<ReturnType<typeof findExistingClinic>>>;

// Mutable Shopify-sourced fields only — admin-managed fields (commissionPct,
// portal login, agreement state) are never touched here.
function customerUpdateData(record: CustomerRecord, existing: ClinicRow) {
  // Only ever upgrade a synthetic fallback code to a real one; never replace a
  // real code (admin- or note-assigned) with a fallback or a different real code.
  const code =
    !isFallbackCode(record.code) && isFallbackCode(existing.code)
      ? record.code
      : existing.code;

  return {
    name: record.name,
    code,
    tag: record.tag,
    // `@unique` on shopifyCustomerId blocks a bad rebind; keep whatever is set.
    shopifyCustomerId: existing.shopifyCustomerId ?? record.shopifyCustomerId,
    businessName: record.businessName,
    vatNumber: record.vatNumber,
    email: record.email,
    phone: record.phone,
    status: record.status,
    agreement: record.agreement,
    address: record.address,
  };
}

async function updateClinic(
  id: string,
  data: ReturnType<typeof customerUpdateData>,
) {
  try {
    return await prisma.clinic.update({ where: { id }, data });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    // The real code we tried to promote is still held by a not-yet-merged
    // duplicate row — refresh every other field now, leave the code for
    // `npm run db:dedupe` to reconcile.
    const { code, ...rest } = data;
    void code;
    return prisma.clinic.update({ where: { id }, data: rest });
  }
}

async function upsertCustomer(record: CustomerRecord) {
  const existing = await findExistingClinic(record);
  if (existing) {
    return updateClinic(existing.id, customerUpdateData(record, existing));
  }

  try {
    return await prisma.clinic.create({
      data: {
        name: record.name,
        code: record.code,
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
    // A concurrent webhook / pull created the row between our find and create —
    // re-resolve and update it instead of duplicating.
    const raced = await findExistingClinic(record);
    if (!raced) throw error;
    return updateClinic(raced.id, customerUpdateData(record, raced));
  }
}

export async function ingestCustomers(
  raw: ShopifyCustomer[],
  source: IngestSource,
): Promise<CustomerIngestResult> {
  const clinics: CustomerRecord[] = [];
  const clients: CustomerRecord[] = [];
  const errors: { code: string; error: string }[] = [];

  for (const customer of raw) {
    const record = transformCustomer(customer);
    (record.tag === "clinic" ? clinics : clients).push(record);
    try {
      await upsertCustomer(record);
    } catch (error) {
      errors.push({
        code: record.code,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
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
        payload: source === "webhook" ? (raw as never) : undefined,
      },
    });
  } catch {
    // logging failure must not fail the ingest
  }

  return {
    total: raw.length,
    clinicsCount: clinics.length,
    clientsCount: clients.length,
    clinics,
    clients,
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
        customerName: record.customerName,
        customerEmail: record.customerEmail,
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
