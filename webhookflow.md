The admin panel ingests data from Shopify. Two raw Shopify API dumps were provided: ↑
LIST CUSTOMERS.txt (10 customers) and LIST ORDERS.txt (10 orders). Each payload is
huge and mostly irrelevant. We need to: ↑

1.  Bifurcate Shopify customers into clinic vs client using the tags field ↑
    (a customer is a clinic when its tags contain clinic, otherwise a client), and
    map each down to the lean reference structure plus a new tag field. ↑
2.  Ingest that data via a POST clinic-data webhook that persists into the DB.
3.  Ingest clinic orders via a POST clinic-order-data webhook, linking each order to a ↑
    clinic by its clinic code (found on the order), reusing the existing commission logic.
4.  Expose GET getProfileUrl returning the clinic detail page URL for a code ↑
    (e.g. /clinic/details/APX-008).

Decisions confirmed with the user: webhooks persist to DB; auth matches existing
patterns (webhooks open, guarded by an optional shared secret; getProfileUrl requires an ↑
admin session); getProfileUrl takes ?code= and returns a relative URL; clinics and
clients are stored in one table (clinics) distinguished by a new tag field. ↑

Key facts from exploration ↑

- Clinic linkage on orders (LIST ORDERS.txt): the clinic code appears in ↑
  note_attributes as {name:"clinic_code", value:"NHS1"} and/or in tags as
  clinic_id_NHS1. Some orders have neither (walk-in / no clinic) → skipped. ↑
- Clinic/client note parsing (LIST CUSTOMERS.txt): the note string carries
  Clinic address:, Clinic code:, Legal business name: / Registered Business Name: / ↑
  business name:, VAT number:, and accepted terms of service: true. Lines are separated
  by \r\n or \n; keys are case-insensitive. Client notes may be None. ↑
- Existing patterns to reuse:
  - app/api/webhooks/shopify/route.ts — webhook shape: raw-body read, optional HMAC/secret ↑
    guard, WebhookLog upsert on success/failure, prisma.order.upsert, order-status
    derivation, commission computation. ↑
  - lib/commission.ts — resolveCommissionPct(clinicId) + computeCommission(total, pct).
  - lib/api-utils.ts — requireSession(), handleApiError(), ApiError. ↑
  - app/api/clinics/route.ts — Zod validation + NextResponse.json({ data }) convention,
    code .toUpperCase(). ↑
  - app/clinic/details/[code]/page.tsx — the profile page getProfileUrl points at.
- middleware.ts matcher excludes api, so /api/\* routes bypass middleware; auth is ↑
  per-route. Webhooks omit requireSession; getProfileUrl calls it.
  ↑
  Changes
  ↑

1.  Prisma schema — prisma/schema.prisma
    ↑

- Add enum:
  prisma ↑
  enum ClinicTag { clinic client }
- On model Clinic, add (all with safe defaults so existing rows/queries are unaffected): ↑
  - tag ClinicTag @default(clinic)
  - shopifyCustomerId String? — source Shopify customer id (traceability; not the upsert key) ↑
  - businessName String? — parsed from note
  - vatNumber String? — parsed from note ↑
- code stays @unique and remains the upsert key. Clients (and clinics whose note has
  no code) get a deterministic synthetic code so uniqueness holds: ↑
  - clinic with code → parsed code, upper-cased
  - clinic without code → CLINIC-<shopifyId> ↑
  - client → CUST-<shopifyId>
- Run npx prisma generate and npx prisma db push (MongoDB, additive/non-destructive). ↑

2.  Shared transformer — lib/shopify-transform.ts (new) ↑

Pure functions, no DB, unit-testable, reused by both webhooks and the bifurcation script: ↑

- parseCustomerNote(note?): { clinicCode?, address?, businessName?, vatNumber?, acceptedTerms }
  — tolerant line parser (\r\n/\n, case-insensitive keys, the business-name aliases). ↑
- isClinic(tags?): boolean — comma-split, trim, lower-case, includes("clinic").
- transformCustomer(c) → the lean reference record: ↑
  { tag, name, code, email, phone, status, agreement, commissionPct, joined, address, loginEmail, loginHash, businessName, vatNumber, shopifyCustomerId }.
  - name: first_name + last_name (fallback to businessName). ↑
  - status: state==="enabled" ? "active" : "suspended".
  - agreement: acceptedTerms ? "accepted" : "not_sent". ↑
  - commissionPct: default 12 (not present in Shopify).
  - joined: created_at. address: note address → else formatted default_address. ↑
  - loginEmail/loginHash: null (set later via the portal flow).
- extractClinicCode(order): string | null — note*attributes.clinic_code → else parse ↑
  clinic_id*<code> from tags → else null.
- transformOrder(o) → lean order record: ↑
  { shopifyId, number, clinicCode, status, total, items, customerName, customerEmail, lineItems, shopifyCreatedAt } where lineItems is trimmed to
  { title, sku, quantity, price }[], and status derives from ↑
  cancelled_at → cancelled, financial_status==="refunded" → refunded,
  fulfillment_status==="fulfilled" → fulfilled, financial_status==="paid" → processing, ↑
  else pending.
  ↑

3.  POST /api/webhooks/clinic-data — app/api/webhooks/clinic-data/route.ts (new)
    ↑

- Accepts a single Shopify customer object or { customers: [...] } (the dump shape).
- Optional guard: if process.env.CLINIC_WEBHOOK_SECRET is set, require matching ↑
  x-webhook-secret header (mirrors the shopify secret pattern; open when unset).
- For each customer: transformCustomer → resolve code (synthetic fallback as above) → ↑
  prisma.clinic.upsert({ where:{ code }, create/update }) writing tag and the mapped fields.
  create-only fields (commissionPct, loginEmail/Hash) are not overwritten on update. ↑
- Record one WebhookLog (provider:"shopify", event:"customers/bifurcate"); return
  { received:true, clinics:[...], clients:[...] } (the bifurcated, transformed data). ↑

4.  POST /api/webhooks/clinic-order-data — app/api/webhooks/clinic-order-data/route.ts (new) ↑

- Accepts a single order or { orders: [...] }; same optional-secret guard. ↑
- For each order: transformOrder → extractClinicCode. If no code or no matching ↑
  prisma.clinic.findUnique({ where:{ code } }), skip and note it. Otherwise
  resolveCommissionPct(clinic.id) + computeCommission(total, pct) and
  prisma.order.upsert({ where:{ shopifyId }, ... }) (same fields as the shopify webhook).
- Per-order WebhookLog (event:"orders/ingest"); return { received, processed, skipped }.

5.  GET /api/getProfileUrl — app/api/getProfileUrl/route.ts (new)

- requireSession(); read ?code=. 400 if missing.
- prisma.clinic.findUnique({ where:{ code } }); 404 via ApiError if absent.
- Return { data: { code: clinic.code, url: /clinic/details/${clinic.code} } }.
- Wrap in try/catch → handleApiError.

Verification

- Types/build: npx tsc --noEmit (or npm run build) — no type errors.
- Bifurcation sanity (offline): a small node script feeds the exact LIST CUSTOMERS.txt
  payload through transformCustomer and prints { clinics, clients }. Expected: the four
  clinic-tagged notes (e.g. codes VU2026, Testcode123456, CL12345, and the empty-code
  one → CLINIC-<id>) land under clinics; Marcus Posner, Neil Shone, Raymond Lee, etc.
  land under clients with synthetic CUST-<id> codes.
- clinic-data webhook: curl -X POST /api/webhooks/clinic-data with the customers JSON →
  { clinics, clients } in the response; confirm rows via the /clinics page or a Prisma query, each carrying the correct tag.
- getProfileUrl: logged-in GET /api/getProfileUrl?code=VU2026 → { data:{ url: "/clinic/details/VU2026" }}; unknown code → 404; no session → 401.
- clinic-order-data webhook: curl -X POST /api/webhooks/clinic-order-data with the orders
  ON → orders whose code matches an existing clinic (NHS1, 002A, CDO1, 006A) are
  serted with computed commission; orders with no clinic code are reported under skipped.
  Drive the app with the /run skill to confirm the new clinic/order rows render.

Notes / trade-offs

- Storing clients in clinics with tag="client" (user's choice) means client rows carry
  clinic-only fields (commissionPct, agreement) at their defaults — harmless but present.
  code uniqueness is preserved via synthetic codes; existing clinic pages/portal keep working. Schema additions are optional/defaulted → no migration risk to existing documents.
