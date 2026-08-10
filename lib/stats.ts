import { prisma } from "@/lib/prisma";

export function getMonthRange(ref: Date = new Date()) {
  const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
  return { start, end };
}

async function clinicOrderCommissionAggregates() {
  const { start, end } = getMonthRange();

  const [orderAgg, commissionAgg] = await Promise.all([
    prisma.order.groupBy({
      by: ["clinicId"],
      where: { shopifyCreatedAt: { gte: start, lt: end } },
      _count: { _all: true },
      _sum: { total: true },
    }),
    prisma.commission.groupBy({
      by: ["clinicId"],
      where: { status: { not: "cancelled" } },
      _sum: { commission: true },
    }),
  ]);

  return {
    ordersByClinic: new Map(orderAgg.map((o) => [o.clinicId, o])),
    commissionByClinic: new Map(commissionAgg.map((c) => [c.clinicId, c])),
  };
}

export async function getClinicsWithStats() {
  const [clinics, { ordersByClinic, commissionByClinic }] = await Promise.all([
    prisma.clinic.findMany({ orderBy: { createdAt: "desc" } }),
    clinicOrderCommissionAggregates(),
  ]);

  return clinics.map((c) => ({
    ...c,
    ordersMtd: ordersByClinic.get(c.id)?._count._all ?? 0,
    monthSales: ordersByClinic.get(c.id)?._sum.total ?? 0,
    totalCommission: commissionByClinic.get(c.id)?._sum.commission ?? 0,
  }));
}

export async function getClinicWithStats(id: string) {
  const { start, end } = getMonthRange();
  const [clinic, orderAgg, commissionAgg] = await Promise.all([
    prisma.clinic.findUnique({ where: { id } }),
    prisma.order.aggregate({
      where: { clinicId: id, shopifyCreatedAt: { gte: start, lt: end } },
      _count: { _all: true },
      _sum: { total: true },
    }),
    prisma.commission.aggregate({
      where: { clinicId: id, status: { not: "cancelled" } },
      _sum: { commission: true },
    }),
  ]);

  if (!clinic) return null;

  return {
    ...clinic,
    ordersMtd: orderAgg._count._all ?? 0,
    monthSales: orderAgg._sum.total ?? 0,
    totalCommission: commissionAgg._sum.commission ?? 0,
  };
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export async function getDashboardStats() {
  const { start: monthStart, end: monthEnd } = getMonthRange();
  const twelveMonthsAgo = new Date(monthStart);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);

  const [
    activeClinics,
    pendingApprovals,
    ordersMtd,
    payableCommission,
    rangeOrders,
  ] = await Promise.all([
    prisma.clinic.count({ where: { status: "active" } }),
    prisma.clinic.count({ where: { status: "pending" } }),
    prisma.order.count({ where: { shopifyCreatedAt: { gte: monthStart, lt: monthEnd } } }),
    prisma.commission.aggregate({
      where: { status: "payable" },
      _sum: { commission: true },
    }),
    prisma.order.findMany({
      where: { shopifyCreatedAt: { gte: twelveMonthsAgo } },
      select: {
        total: true,
        commission: true,
        commissionPct: true,
        shopifyCreatedAt: true,
        lineItems: true,
        status: true,
      },
    }),
  ]);

  const monthBuckets = new Map<
    string,
    { revenue: number; commission: number; orders: number }
  >();
  for (let i = 0; i < 12; i++) {
    const d = new Date(twelveMonthsAgo);
    d.setMonth(d.getMonth() + i);
    monthBuckets.set(monthKey(d), { revenue: 0, commission: 0, orders: 0 });
  }

  const productTotals = new Map<string, number>();

  for (const o of rangeOrders) {
    const key = monthKey(o.shopifyCreatedAt);
    const bucket = monthBuckets.get(key);
    if (bucket && o.status !== "cancelled" && o.status !== "refunded") {
      bucket.revenue += o.total;
      bucket.commission += o.commission;
      bucket.orders += 1;
    }

    if (Array.isArray(o.lineItems)) {
      for (const item of o.lineItems as Array<Record<string, unknown>>) {
        const title =
          typeof item?.title === "string" ? item.title : "Other";
        const qty = typeof item?.quantity === "number" ? item.quantity : 1;
        productTotals.set(title, (productTotals.get(title) ?? 0) + qty);
      }
    }
  }

  const monthlyRevenue = Array.from(monthBuckets.entries()).map(([key, v]) => {
    const [, m] = key.split("-");
    const label = new Date(2000, parseInt(m, 10) - 1, 1).toLocaleString(
      "en-GB",
      { month: "short" },
    );
    return { m: label, ...v };
  });

  const ordersByProduct = Array.from(productTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([name, orders]) => ({ name, orders }));

  return {
    activeClinics,
    pendingApprovals,
    ordersMtd,
    totalCommissionPayable: payableCommission._sum.commission ?? 0,
    monthlyRevenue,
    ordersByProduct,
  };
}
