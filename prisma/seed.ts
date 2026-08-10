import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const CLINICS = [
  { name: "Halcyon Clinics", code: "HAL-001", email: "ops@halcyon.co.uk", phone: "020 7946 0001", status: "active", agreement: "accepted", commissionPct: 18, address: "12 Harley Street, London, W1G 9PQ", website: "https://halcyon.co.uk", loginEmail: "portal@halcyon.co.uk", joined: "2024-03-15" },
  { name: "Rowan Medical", code: "ROW-002", email: "admin@rowanmedical.co.uk", phone: "0161 496 0022", status: "active", agreement: "accepted", commissionPct: 15, address: "55 King Street, Manchester, M2 4LQ", loginEmail: "portal@rowanmedical.co.uk", joined: "2024-04-02" },
  { name: "Clarity Eye Clinics", code: "CLA-003", email: "info@clarityeye.co.uk", phone: "0117 906 0033", status: "active", agreement: "accepted", commissionPct: 12, address: "7 Park Row, Bristol, BS1 5LP", joined: "2024-05-18" },
  { name: "Meridian Health", code: "MER-004", email: "contact@meridianhealth.co.uk", phone: "0113 497 0044", status: "active", agreement: "accepted", commissionPct: 12, address: "22 The Headrow, Leeds, LS1 6PT", joined: "2024-06-01" },
  { name: "Pinnacle Vision", code: "PIN-005", email: "team@pinvision.co.uk", phone: "0121 496 0055", status: "pending", agreement: "accepted", commissionPct: 12, joined: "2025-12-20" },
  { name: "Eclipse Optometry", code: "ECL-006", email: "info@eclipseoptometry.co.uk", phone: "0131 496 0066", status: "pending", agreement: "viewed", commissionPct: 12, joined: "2026-01-04" },
  { name: "Summit Aesthetics", code: "SUM-007", email: "clinic@summitaesthetics.co.uk", status: "pending", agreement: "sent", commissionPct: 12, joined: "2026-01-10" },
  { name: "Apex Medical Group", code: "APX-008", email: "admin@apexmedical.co.uk", phone: "029 2049 0088", status: "active", agreement: "accepted", commissionPct: 14, address: "33 Cardiff Bay, Cardiff, CF10 4BZ", loginEmail: "portal@apexmedical.co.uk", joined: "2024-08-12" },
  { name: "Nova Aesthetics", code: "NOV-009", email: "hello@novaaesthetics.co.uk", status: "active", agreement: "accepted", commissionPct: 12, joined: "2024-09-05" },
  { name: "Spectrum Clinics", code: "SPE-010", email: "info@spectrumclinics.co.uk", status: "suspended", agreement: "accepted", commissionPct: 12, joined: "2024-07-22" },
] as const;

const CUSTOMERS = [
  "Sarah Mitchell", "James Thornton", "Emily Clarke", "David Walsh", "Priya Nair",
  "Tom Hunter", "Aisha Patel", "Luke Reynolds", "Sophie Gardner", "Mark Chen",
];
const ORDER_STATUSES = ["fulfilled", "fulfilled", "fulfilled", "processing", "pending", "refunded", "cancelled"] as const;
const PRODUCTS = ["Mounjaro", "Contact Lens", "Eye Drops", "Glasses", "Supplements", "Consultations"];

const ADMIN_USERS = [
  { name: "Priya Sharma", email: "priya@clinicdirect.co.uk", role: "super_admin", twoFaEnabled: true, status: "active" },
  { name: "James Whitfield", email: "james@clinicdirect.co.uk", role: "admin", twoFaEnabled: true, status: "active" },
  { name: "Ellie King", email: "ellie@clinicdirect.co.uk", role: "finance", twoFaEnabled: true, status: "active" },
  { name: "Aarav Patel", email: "aarav@clinicdirect.co.uk", role: "support", twoFaEnabled: false, status: "active" },
  { name: "Sophie Blake", email: "sophie@clinicdirect.co.uk", role: "read_only", twoFaEnabled: true, status: "active" },
  { name: "Marcus Hughes", email: "marcus@clinicdirect.co.uk", role: "admin", twoFaEnabled: false, status: "invited" },
] as const;

const COMMISSION_RULES = [
  { scope: "default", scopeLabel: "Default", basis: "percentage", value: 12, appliesToLabel: "All active clinics", priority: 0 },
  { scope: "product:mounjaro", scopeLabel: "Product · Mounjaro", basis: "percentage", value: 15, appliesToLabel: "All clinics", priority: 10 },
  { scope: "clinic:halcyon", scopeLabel: "Clinic · Halcyon", basis: "percentage", value: 18, appliesToLabel: "Halcyon Clinics", priority: 20 },
  { scope: "category:consultations", scopeLabel: "Category · Consultations", basis: "fixed", value: 8, appliesToLabel: "All clinics", priority: 10 },
  { scope: "category:subscription", scopeLabel: "Subscription renewals", basis: "percentage", value: 10, appliesToLabel: "All subscription orders", priority: 5 },
] as const;

async function main() {
  console.log("Seeding database…");

  const passwordHash = await bcrypt.hash("changeme123", 12);

  const clinicRecords = await Promise.all(
    CLINICS.map((c) =>
      prisma.clinic.upsert({
        where: { code: c.code },
        update: {},
        create: {
          name: c.name,
          code: c.code,
          email: c.email,
          phone: "phone" in c ? c.phone : undefined,
          status: c.status,
          agreement: c.agreement,
          commissionPct: c.commissionPct,
          address: "address" in c ? c.address : undefined,
          website: "website" in c ? c.website : undefined,
          loginEmail: "loginEmail" in c ? c.loginEmail : undefined,
          loginHash: "loginEmail" in c ? passwordHash : undefined,
          joined: new Date(c.joined),
        },
      }),
    ),
  );

  // Fix the clinic-scoped rule to point at Halcyon's real ObjectId.
  const halcyon = clinicRecords.find((c) => c.code === "HAL-001")!;
  const rules = COMMISSION_RULES.map((r) =>
    r.scope === "clinic:halcyon" ? { ...r, scope: `clinic:${halcyon.id}` } : r,
  );
  for (const rule of rules) {
    const existing = await prisma.commissionRule.findFirst({ where: { scope: rule.scope } });
    if (!existing) await prisma.commissionRule.create({ data: rule });
  }

  const activeClinics = clinicRecords.filter((c) => c.status === "active");
  const existingOrders = await prisma.order.count();
  if (existingOrders === 0 && activeClinics.length > 0) {
    for (let i = 0; i < 60; i++) {
      const clinic = activeClinics[i % activeClinics.length];
      const total = Math.round(Math.random() * 900 + 100);
      const status = ORDER_STATUSES[i % ORDER_STATUSES.length];
      const commission = Math.round((total * clinic.commissionPct) / 100);
      const product = PRODUCTS[i % PRODUCTS.length];

      await prisma.order.create({
        data: {
          shopifyId: `gid-shopify-order-${102400 + i}`,
          number: `#${102400 + i}`,
          clinicId: clinic.id,
          status,
          total,
          commission,
          commissionPct: clinic.commissionPct,
          items: Math.floor(Math.random() * 5) + 1,
          customerName: CUSTOMERS[i % CUSTOMERS.length],
          customerEmail: `${CUSTOMERS[i % CUSTOMERS.length].toLowerCase().replace(" ", ".")}@example.com`,
          lineItems: [{ title: product, quantity: Math.floor(Math.random() * 3) + 1 }],
          shopifyCreatedAt: new Date(Date.now() - (i * 4 + Math.random() * 4) * 3_600_000),
        },
      });
    }
  }

  const period = new Date().toISOString().slice(0, 7);
  for (const clinic of activeClinics) {
    const orders = await prisma.order.findMany({
      where: { clinicId: clinic.id, status: { not: "cancelled" } },
    });
    if (orders.length === 0) continue;
    const gross = orders.reduce((s, o) => s + o.total, 0);
    const commission = Math.round((gross * clinic.commissionPct) / 100);
    const vat = Math.round(commission * 0.2);

    const existing = await prisma.commission.findFirst({ where: { clinicId: clinic.id, period } });
    if (!existing) {
      await prisma.commission.create({
        data: {
          clinicId: clinic.id,
          period,
          gross,
          commission,
          rate: clinic.commissionPct,
          vat,
          status: ["approved", "payable", "paid", "approved"][
            activeClinics.indexOf(clinic) % 4
          ] as never,
        },
      });
    }
  }

  for (const u of ADMIN_USERS) {
    await prisma.adminUser.upsert({
      where: { email: u.email },
      update: {},
      create: {
        name: u.name,
        email: u.email,
        role: u.role,
        twoFaEnabled: u.twoFaEnabled,
        status: u.status,
        password: "changeme123",
        lastLoginAt: new Date(),
      },
    });
  }

  console.log("Seed complete. Default password for all admin users: changeme123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
