# Invoice Flow — How Self-Billed Invoices Are Created, Generated & Managed

This document explains the full lifecycle of **self-billed invoices** in the Clinic
Direct Admin app: where the data comes from, how invoices are generated, and how
they move through their status lifecycle until paid.

> **What is a "self-billed" invoice here?**
> Clinic Direct raises the invoice *on behalf of the clinic* for the commission it
> owes that clinic. The clinic never sends an invoice — the admin generates one
> per clinic per billing period from that clinic's approved commissions, then
> "pushes" it to the downstream finance system (Orderwise).

---

## 1. The data chain

Invoices sit at the **end** of a chain. Nothing about an invoice is entered by
hand — it is derived entirely from upstream records:

```
Shopify Orders  ──►  Commission run  ──►  Commissions approved  ──►  Invoices generated  ──►  Pushed to Orderwise  ──►  Paid
   (orders)          (per clinic/month)      (finance review)        (1 per clinic/period)      (status: pushed)      (status: paid)
```

| Model        | Role in the chain                                                                 |
|--------------|-----------------------------------------------------------------------------------|
| `Order`      | Raw sales ingested from Shopify. Each has a `total`, `clinicId`, and date.        |
| `Commission` | Monthly per-clinic summary: sum of orders × rate, plus VAT. Has a `status`.       |
| `Invoice`    | One per clinic per period, generated from that clinic's **approved** commissions. |

---

## 2. Upstream: how commissions get ready to invoice

Invoices can only be generated from commissions whose `status` is `approved` and
which have **not already been attached to an invoice**.

### 2a. Commission run — `POST /api/commissions`
*(`app/api/commissions/route.ts`)*

For a given `period` (`"YYYY-MM"`), for every **active** clinic:

1. Fetch that clinic's orders in the month window (`shopifyCreatedAt` between the
   1st of the month and the 1st of the next), excluding `cancelled` orders.
2. `gross` = sum of order totals.
3. `rate` = resolved via `resolveCommissionPct(clinicId)` (`lib/commission.ts`):
   clinic-specific rule → default rule → the clinic's own `commissionPct` (fallback 12%).
4. `commission` = `computeCommission(gross, rate)` = `round(gross × pct) / 100`.
5. `vat` = `round(commission × 0.2 × 100) / 100` (20% VAT).
6. **Upsert** a `Commission` record for that clinic+period (updates if one exists,
   else creates). New records default to `status: "payable"`.

Result: a set of `Commission` records in `payable` status.

### 2b. Approval — `PATCH /api/commissions/[id]`
*(`app/api/commissions/[id]/route.ts`)*

Finance reviews commissions and flips their `status`
(`payable` → `approved` → `paid` / `cancelled`). Only **`approved`** commissions
are eligible to be invoiced. Every status change is written to the audit log.

---

## 3. Generating invoices — `POST /api/invoices`
*(`app/api/invoices/route.ts`)*

This is the core "create invoices" step. Triggered from the Invoices page UI
(the **Generate invoices** button + period dropdown).

**Input:** `{ period: "YYYY-MM" }` (validated with Zod).

**Logic:**

1. Compute the period window (`periodStart` = 1st of month, `periodEnd` = 1st of next month).
2. Find all commissions that are:
   - in the given `period`,
   - `status: "approved"`,
   - **not yet invoiced** — matched as `invoiceId == null` **OR** `invoiceId` unset.
     (Both conditions are needed: seeded records have the field absent, which
     Prisma's `invoiceId: null` alone would not catch.)
   - If none are found → `400 "No approved commissions ready to invoice for this period"`.
3. **Group the commissions by `clinicId`** → one invoice per clinic.
4. **Idempotency guard:** load clinics that already have an invoice for this
   `periodStart`, and **skip** them, so re-running the generator can't produce a
   duplicate invoice for the same clinic + period.
5. For each remaining clinic:
   - `commission` total = sum of that clinic's commission amounts.
   - `vat` total = sum of their VAT amounts.
   - `total` = `commission + vat`.
   - Create the `Invoice` with `status: "issued"`, the period window, and a
     freshly allocated invoice **number** (see below).
   - Update all those commission records to point at the new invoice
     (`invoiceId = invoice.id`) — this marks them as consumed so they won't be
     re-invoiced.
6. Write an audit log entry (`invoice.generated`) recording how many were
   created and how many were skipped.

**Response:** `201` with the created invoices (and a `skipped` count if any).

### Invoice numbering — `nextInvoiceNumber()`

- Format: **`SBI-{year}-{sequence}`** (e.g. `SBI-2026-1000`).
- Sequence starts at **1000** (the reducer seeds `max` at `999`, so the first is `1000`).
- The max existing sequence is parsed **numerically** (not lexically) so numbers
  don't sort wrong across digit widths (e.g. `…-9999` vs `…-10000`).

### Concurrency safety — `createInvoice()`

The `number` field is `@unique`. If two runs race and collide on a number,
Prisma throws a `P2002` unique-constraint error. `createInvoice()` catches this
and **retries up to 5 times**, re-allocating a fresh number each attempt.

---

## 4. Invoice status lifecycle

Statuses come from the `InvoiceStatus` enum (`prisma/schema.prisma`):

```
draft ──► issued ──► pushed ──► paid
                │
                └──► voided
```

| Status   | Meaning                                                                 |
|----------|-------------------------------------------------------------------------|
| `draft`  | Model default; not used by the generator (which creates `issued`).      |
| `issued` | Generated and awaiting push to Orderwise. ("Awaiting push" on the UI.)  |
| `pushed` | Sent to Orderwise. Sets `pushedAt`.                                      |
| `paid`   | Payment recorded. Sets `paidAt`.                                        |
| `voided` | Cancelled invoice.                                                      |

### Push to Orderwise — `POST /api/invoices/push`
*(`app/api/invoices/push/route.ts`)*

Bulk operation: moves **every** `issued` invoice → `pushed`, stamping `pushedAt`.
(Currently a simulated send.) Triggered by the **Push queued** button, which is
disabled when nothing is awaiting push. Audited as `invoice.pushed`.

### Update a single invoice — `PATCH /api/invoices/[id]`
*(`app/api/invoices/[id]/route.ts`)*

Updates `status` and/or `notes` for one invoice. Automatically sets `pushedAt`
when moving to `pushed`, and `paidAt` when moving to `paid`. Status changes are
audited as `invoice.status.updated`.

---

## 5. Reading & exporting invoices

| Endpoint / UI                        | What it does                                                                 |
|--------------------------------------|------------------------------------------------------------------------------|
| `GET /api/invoices`                  | List invoices; optional `?status=` and `?clinicId=` filters. Newest first.   |
| `GET /api/invoices/[id]`             | Fetch one invoice (with clinic name/code). Used as the per-row JSON download. |
| `GET /api/invoices/export`           | Streams all invoices as a **CSV** download (`number,date,clinic,commission,vat,total,status`). |
| `/(admin)/invoices` page             | The admin UI — stat cards, invoices table, Generate / Push / Export actions.  |

**All endpoints require an authenticated session** (`requireSession()`).

### The Invoices page — `app/(admin)/invoices/page.tsx`

- **Stat cards:** total invoice count, total billed (£), awaiting push count, paid count.
- **Generate control:** the period dropdown is populated by a `groupBy` over
  commissions that are `approved` and not-yet-invoiced — so you can only pick
  periods that actually have something to invoice. If none, the button reads
  "No commissions to invoice."
- **Table:** every invoice with number, date, clinic, commission, VAT, total,
  status pill, and a per-row JSON download link.

---

## 6. Data model — `Invoice` (Prisma / MongoDB)

```prisma
model Invoice {
  id          String        @id @default(auto()) @map("_id") @db.ObjectId
  number      String        @unique          // "SBI-2026-1000"
  clinicId    String?       @db.ObjectId
  clinic      Clinic?       @relation(...)    // onDelete: SetNull
  commission  Float                           // sum of clinic's commission amounts
  vat         Float                           // sum of VAT amounts
  total       Float                           // commission + vat
  status      InvoiceStatus @default(draft)
  periodStart DateTime?                        // 1st of billing month
  periodEnd   DateTime?                        // 1st of next month
  pushedAt    DateTime?                        // set when pushed to Orderwise
  paidAt      DateTime?                        // set when marked paid
  notes       String?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
}
```

The linked `Commission` records carry `invoiceId` back-pointing to the invoice
they were rolled into.

---

## 7. End-to-end summary

1. **Orders** are ingested from Shopify.
2. Admin runs a **commission run** for a period → per-clinic `Commission` records (`payable`).
3. Finance **approves** commissions (`payable` → `approved`).
4. Admin clicks **Generate invoices** for a period → `POST /api/invoices`:
   - groups approved, un-invoiced commissions by clinic,
   - creates **one `issued` invoice per clinic** (`SBI-YYYY-####`),
   - links the commissions to the invoice so they can't be double-billed.
5. Admin clicks **Push queued** → all `issued` invoices become `pushed` (to Orderwise).
6. Invoice is later marked **`paid`** (or **`voided`**) via `PATCH`.
7. Invoices can be **listed, downloaded (JSON), or exported (CSV)** at any point.

Every state-changing step is recorded in the **audit log**
(`invoice.generated`, `invoice.pushed`, `invoice.status.updated`,
`commission.run.completed`, `commission.status.updated`).

---

### Key files

| Concern                     | File                                          |
|-----------------------------|-----------------------------------------------|
| Generate + list invoices    | `app/api/invoices/route.ts`                   |
| Push all issued invoices    | `app/api/invoices/push/route.ts`              |
| Get / update one invoice    | `app/api/invoices/[id]/route.ts`              |
| CSV export                  | `app/api/invoices/export/route.ts`            |
| Invoices admin UI           | `app/(admin)/invoices/page.tsx`               |
| Generate / Push buttons     | `app/(admin)/invoices/invoice-actions.tsx`    |
| Commission run + approval   | `app/api/commissions/route.ts`, `[id]/route.ts` |
| Rate resolution / calc      | `lib/commission.ts`                           |
| Schema (Invoice/Commission) | `prisma/schema.prisma`                        |
