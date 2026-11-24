import { prisma } from "@/lib/prisma";

// A clinic has two separate identifiers:
//   code        permanent unique id (CUST-<shopifyId> for Shopify customers).
//               Used in portal links and agreement refs — never changes.
//   clinicCode  the business code from the Shopify note ("Clinic code: …"),
//               which is what orders carry.
// Clinics added by hand or CSV, and rows that predate `clinicCode`, keep their
// business code in `code`, so lookups fall back to it.

/** Resolve the clinic an order / CSV / URL refers to: `clinicCode` first, then `code`. */
export async function findClinicByCode(value: string) {
  const raw = value.trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();

  const byClinicCode = await prisma.clinic.findFirst({
    where: { clinicCode: upper },
    orderBy: { createdAt: "asc" }, // deterministic should a duplicate ever slip in
  });
  if (byClinicCode) return byClinicCode;

  return (
    (await prisma.clinic.findUnique({ where: { code: raw } })) ??
    (upper === raw ? null : await prisma.clinic.findUnique({ where: { code: upper } }))
  );
}

/**
 * True when another clinic already uses this value as its `clinicCode` or `code`.
 * `clinicCode` can't carry a unique index: most rows have none, and MongoDB
 * unique indexes treat every missing value as the same null.
 */
export async function isClinicCodeTaken(value: string, exceptId?: string): Promise<boolean> {
  const other = await prisma.clinic.findFirst({
    where: {
      OR: [{ clinicCode: value }, { code: value }],
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true },
  });
  return other !== null;
}
