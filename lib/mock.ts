import type {
  Clinic,
  Order,
  CommissionRecord,
  Invoice,
  AdminUser,
  AuditEntry,
  MonthlyDataPoint,
  ProductOrderPoint,
} from "@/types";

/* ─── Clinics ────────────────────────────────────────────────── */

export const clinics: Clinic[] = [
  {
    id: "c1",
    name: "Halcyon Clinics",
    code: "HAL-001",
    email: "ops@halcyon.co.uk",
    phone: "020 7946 0001",
    status: "active",
    agreement: "accepted",
    commissionPct: 18,
    joined: "2024-03-15",
    address: "12 Harley Street, London, W1G 9PQ",
    website: "https://halcyon.co.uk",
    ordersMtd: 142,
    monthSales: 28400,
    totalCommission: 91240,
    loginEmail: "portal@halcyon.co.uk",
  },
  {
    id: "c2",
    name: "Rowan Medical",
    code: "ROW-002",
    email: "admin@rowanmedical.co.uk",
    phone: "0161 496 0022",
    status: "active",
    agreement: "accepted",
    commissionPct: 15,
    joined: "2024-04-02",
    address: "55 King Street, Manchester, M2 4LQ",
    ordersMtd: 98,
    monthSales: 19200,
    totalCommission: 58700,
    loginEmail: "portal@rowanmedical.co.uk",
  },
  {
    id: "c3",
    name: "Clarity Eye Clinics",
    code: "CLA-003",
    email: "info@clarityeye.co.uk",
    phone: "0117 906 0033",
    status: "active",
    agreement: "accepted",
    commissionPct: 12,
    joined: "2024-05-18",
    address: "7 Park Row, Bristol, BS1 5LP",
    ordersMtd: 76,
    monthSales: 14800,
    totalCommission: 32100,
  },
  {
    id: "c4",
    name: "Meridian Health",
    code: "MER-004",
    email: "contact@meridianhealth.co.uk",
    phone: "0113 497 0044",
    status: "active",
    agreement: "accepted",
    commissionPct: 12,
    joined: "2024-06-01",
    address: "22 The Headrow, Leeds, LS1 6PT",
    ordersMtd: 63,
    monthSales: 11200,
    totalCommission: 18400,
  },
  {
    id: "c5",
    name: "Pinnacle Vision",
    code: "PIN-005",
    email: "team@pinvision.co.uk",
    phone: "0121 496 0055",
    status: "pending",
    agreement: "accepted",
    commissionPct: 12,
    joined: "2025-12-20",
    ordersMtd: 0,
    monthSales: 0,
    totalCommission: 0,
  },
  {
    id: "c6",
    name: "Eclipse Optometry",
    code: "ECL-006",
    email: "info@eclipseoptometry.co.uk",
    phone: "0131 496 0066",
    status: "pending",
    agreement: "viewed",
    commissionPct: 12,
    joined: "2026-01-04",
    ordersMtd: 0,
    monthSales: 0,
    totalCommission: 0,
  },
  {
    id: "c7",
    name: "Summit Aesthetics",
    code: "SUM-007",
    email: "clinic@summitaesthetics.co.uk",
    status: "pending",
    agreement: "sent",
    commissionPct: 12,
    joined: "2026-01-10",
    ordersMtd: 0,
    monthSales: 0,
    totalCommission: 0,
  },
  {
    id: "c8",
    name: "Apex Medical Group",
    code: "APX-008",
    email: "admin@apexmedical.co.uk",
    phone: "029 2049 0088",
    status: "active",
    agreement: "accepted",
    commissionPct: 14,
    joined: "2024-08-12",
    address: "33 Cardiff Bay, Cardiff, CF10 4BZ",
    ordersMtd: 55,
    monthSales: 9800,
    totalCommission: 22300,
    loginEmail: "portal@apexmedical.co.uk",
  },
  {
    id: "c9",
    name: "Nova Aesthetics",
    code: "NOV-009",
    email: "hello@novaaesthetics.co.uk",
    status: "active",
    agreement: "accepted",
    commissionPct: 12,
    joined: "2024-09-05",
    ordersMtd: 44,
    monthSales: 7600,
    totalCommission: 15800,
  },
  {
    id: "c10",
    name: "Spectrum Clinics",
    code: "SPE-010",
    email: "info@spectrumclinics.co.uk",
    status: "suspended",
    agreement: "accepted",
    commissionPct: 12,
    joined: "2024-07-22",
    ordersMtd: 0,
    monthSales: 0,
    totalCommission: 8200,
  },
];

/* ─── Orders ────────────────────────────────────────────────── */

const orderStatuses = [
  "fulfilled",
  "fulfilled",
  "fulfilled",
  "processing",
  "pending",
  "refunded",
  "cancelled",
] as const;
const customers = [
  "Sarah Mitchell",
  "James Thornton",
  "Emily Clarke",
  "David Walsh",
  "Priya Nair",
  "Tom Hunter",
  "Aisha Patel",
  "Luke Reynolds",
  "Sophie Gardner",
  "Mark Chen",
];

export const orders: Order[] = Array.from({ length: 60 }, (_, i) => {
  const clinic = clinics[i % clinics.filter((c) => c.status === "active").length];
  const total = Math.round(Math.random() * 900 + 100);
  return {
    id: `o${i + 1}`,
    shopifyId: `gid://shopify/Order/${102400 + i}`,
    number: `#${102400 + i}`,
    clinicId: clinic.id,
    clinicName: clinic.name,
    clinicCode: clinic.code,
    status: orderStatuses[i % orderStatuses.length],
    total,
    commission: Math.round((total * clinic.commissionPct) / 100),
    items: Math.floor(Math.random() * 5) + 1,
    customer: customers[i % customers.length],
    createdAt: new Date(
      Date.now() - (i * 4 + Math.random() * 4) * 3_600_000,
    ).toISOString(),
  };
});

/* ─── Commission ────────────────────────────────────────────── */

const commissionStatuses = [
  "approved",
  "payable",
  "paid",
  "approved",
] as const;

export const commissions: CommissionRecord[] = clinics
  .filter((c) => c.status === "active")
  .map((c, i) => ({
    id: `com${i + 1}`,
    clinicId: c.id,
    clinicName: c.name,
    clinicCode: c.code,
    period: "2026-07",
    gross: c.monthSales,
    commission: Math.round((c.monthSales * c.commissionPct) / 100),
    rate: c.commissionPct,
    status: commissionStatuses[i % commissionStatuses.length],
  }));

/* ─── Invoices ──────────────────────────────────────────────── */

const invoiceStatuses = [
  "paid",
  "pushed",
  "issued",
  "paid",
  "paid",
  "pushed",
  "issued",
  "draft",
] as const;

export const invoices: Invoice[] = clinics.slice(0, 8).map((c, i) => {
  const commission = Math.round((c.monthSales * c.commissionPct) / 100);
  const vat = Math.round(commission * 0.2);
  return {
    id: `inv${i + 1}`,
    number: `SBI-2026-${1013 - i}`,
    clinicId: c.id,
    clinic: c.name,
    commission,
    vat,
    total: commission + vat,
    status: invoiceStatuses[i % invoiceStatuses.length],
    date: new Date(
      Date.now() - (i * 2 + 1) * 24 * 3_600_000,
    ).toISOString(),
  };
});

/* ─── Admin Users ────────────────────────────────────────────── */

export const adminUsers: AdminUser[] = [
  {
    id: "u1",
    name: "Priya Sharma",
    email: "priya@clinicdirect.co.uk",
    role: "super_admin",
    twoFa: true,
    status: "active",
    lastActive: new Date(Date.now() - 2 * 60000).toISOString(),
  },
  {
    id: "u2",
    name: "James Whitfield",
    email: "james@clinicdirect.co.uk",
    role: "admin",
    twoFa: true,
    status: "active",
    lastActive: new Date(Date.now() - 14 * 60000).toISOString(),
  },
  {
    id: "u3",
    name: "Ellie King",
    email: "ellie@clinicdirect.co.uk",
    role: "finance",
    twoFa: true,
    status: "active",
    lastActive: new Date(Date.now() - 60 * 60000).toISOString(),
  },
  {
    id: "u4",
    name: "Aarav Patel",
    email: "aarav@clinicdirect.co.uk",
    role: "support",
    twoFa: false,
    status: "active",
    lastActive: new Date(Date.now() - 3 * 60 * 60000).toISOString(),
  },
  {
    id: "u5",
    name: "Sophie Blake",
    email: "sophie@clinicdirect.co.uk",
    role: "read_only",
    twoFa: true,
    status: "active",
    lastActive: new Date(Date.now() - 24 * 60 * 60000).toISOString(),
  },
  {
    id: "u6",
    name: "Marcus Hughes",
    email: "marcus@clinicdirect.co.uk",
    role: "admin",
    twoFa: false,
    status: "invited",
    lastActive: new Date(Date.now() - 48 * 60 * 60000).toISOString(),
  },
];

/* ─── Audit Log ─────────────────────────────────────────────── */

export const auditLog: AuditEntry[] = [
  {
    id: "a1",
    time: new Date(Date.now() - 2 * 60000).toISOString(),
    userEmail: "system",
    action: "order.synced",
    target: "#102428",
    prev: "—",
    next: "synced",
    ip: "10.0.0.4",
  },
  {
    id: "a2",
    time: new Date(Date.now() - 14 * 60000).toISOString(),
    userEmail: "priya@clinicdirect.co.uk",
    action: "clinic.approved",
    target: "Halcyon Clinics",
    prev: "pending",
    next: "active",
    ip: "82.34.128.19",
  },
  {
    id: "a3",
    time: new Date(Date.now() - 42 * 60000).toISOString(),
    userEmail: "james@clinicdirect.co.uk",
    action: "commission.rule.updated",
    target: "Rule #3 · Halcyon",
    prev: "15%",
    next: "18%",
    ip: "82.34.128.44",
  },
  {
    id: "a4",
    time: new Date(Date.now() - 60 * 60000).toISOString(),
    userEmail: "system",
    action: "invoice.generated",
    target: "SBI-2026-1013",
    prev: "—",
    next: "issued",
    ip: "10.0.0.4",
  },
  {
    id: "a5",
    time: new Date(Date.now() - 3 * 60 * 60000).toISOString(),
    userEmail: "ellie@clinicdirect.co.uk",
    action: "invoice.pushed",
    target: "SBI-2026-1012",
    prev: "issued",
    next: "pushed",
    ip: "82.34.128.71",
  },
  {
    id: "a6",
    time: new Date(Date.now() - 6 * 60 * 60000).toISOString(),
    userEmail: "priya@clinicdirect.co.uk",
    action: "user.invited",
    target: "marcus@clinicdirect.co.uk",
    prev: "—",
    next: "invited",
    ip: "82.34.128.19",
  },
  {
    id: "a7",
    time: new Date(Date.now() - 26 * 60 * 60000).toISOString(),
    userEmail: "system",
    action: "webhook.failed",
    target: "orders/create · #102422",
    prev: "attempt 2",
    next: "attempt 3",
    ip: "10.0.0.4",
  },
  {
    id: "a8",
    time: new Date(Date.now() - 27 * 60 * 60000).toISOString(),
    userEmail: "aarav@clinicdirect.co.uk",
    action: "clinic.notes.updated",
    target: "Rowan Medical",
    prev: "—",
    next: "1 note added",
    ip: "82.34.128.201",
  },
];

/* ─── Dashboard Charts ──────────────────────────────────────── */

export const monthlyRevenue: MonthlyDataPoint[] = [
  { m: "Aug", revenue: 68200, commission: 8184, orders: 310 },
  { m: "Sep", revenue: 74500, commission: 8940, orders: 338 },
  { m: "Oct", revenue: 82100, commission: 9852, orders: 372 },
  { m: "Nov", revenue: 79400, commission: 9528, orders: 362 },
  { m: "Dec", revenue: 91800, commission: 11016, orders: 418 },
  { m: "Jan", revenue: 86200, commission: 10344, orders: 394 },
  { m: "Feb", revenue: 94300, commission: 11316, orders: 430 },
  { m: "Mar", revenue: 102400, commission: 12288, orders: 468 },
  { m: "Apr", revenue: 98700, commission: 11844, orders: 451 },
  { m: "May", revenue: 108900, commission: 13068, orders: 495 },
  { m: "Jun", revenue: 116200, commission: 13944, orders: 530 },
  { m: "Jul", revenue: 91000, commission: 10920, orders: 415 },
];

export const ordersByProduct: ProductOrderPoint[] = [
  { name: "Mounjaro", orders: 186 },
  { name: "Contact Lens", orders: 142 },
  { name: "Eye Drops", orders: 98 },
  { name: "Glasses", orders: 74 },
  { name: "Supplements", orders: 62 },
  { name: "Consultations", orders: 44 },
  { name: "Other", orders: 29 },
];

/* ─── Commission Rules ──────────────────────────────────────── */

export const commissionRules = [
  {
    id: 1,
    scope: "Default",
    basis: "Percentage",
    value: "12%",
    applies: "All active clinics",
    status: "active",
  },
  {
    id: 2,
    scope: "Product · Mounjaro",
    basis: "Percentage",
    value: "15%",
    applies: "All clinics",
    status: "active",
  },
  {
    id: 3,
    scope: "Clinic · Halcyon",
    basis: "Percentage",
    value: "18%",
    applies: "Halcyon Clinics",
    status: "active",
  },
  {
    id: 4,
    scope: "Category · Consultations",
    basis: "Fixed",
    value: "£8.00",
    applies: "All clinics",
    status: "active",
  },
  {
    id: 5,
    scope: "Subscription renewals",
    basis: "Percentage",
    value: "10%",
    applies: "All subscription orders",
    status: "active",
  },
];
