import { Suspense } from "react";
import { Download, ShoppingBag } from "lucide-react";
import { Prisma } from "@prisma/client";
import { PageHeader, PageBody } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { currency, relativeTime } from "@/lib/utils";
import { OrderFilters } from "./order-filters";

export const metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

const statusTone: Record<
  string,
  "success" | "warning" | "destructive" | "info" | "muted"
> = {
  fulfilled: "success",
  processing: "info",
  pending: "warning",
  refunded: "destructive",
  cancelled: "muted",
};

interface Props {
  searchParams: Promise<{ search?: string; status?: string; clinicId?: string }>;
}

export default async function OrdersPage({ searchParams }: Props) {
  const { search, status, clinicId } = await searchParams;

  const where: Prisma.OrderWhereInput = {};
  if (status) where.status = status as Prisma.OrderWhereInput["status"];
  if (clinicId) where.clinicId = clinicId;
  if (search) {
    where.OR = [
      { number: { contains: search, mode: "insensitive" } },
      { customerName: { contains: search, mode: "insensitive" } },
    ];
  }

  const [orders, clinics, totalCount, fulfilledCount, activeAgg] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { clinic: { select: { name: true, code: true } } },
      orderBy: { shopifyCreatedAt: "desc" },
      take: 100,
    }),
    prisma.clinic.findMany({ select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }),
    prisma.order.count(),
    prisma.order.count({ where: { status: "fulfilled" } }),
    prisma.order.aggregate({
      where: { status: { notIn: ["refunded", "cancelled"] } },
      _sum: { total: true, commission: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Orders"
        description="All Shopify orders across all clinic codes."
        actions={
          <Button variant="outline" size="sm" asChild>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download, not a page navigation */}
            <a href="/api/orders/export">
              <Download className="h-4 w-4" />
              Export
            </a>
          </Button>
        }
      />
      <PageBody>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total orders"
            value={totalCount}
            hint="All time"
            icon={<ShoppingBag className="h-4 w-4" />}
          />
          <StatCard label="Fulfilled" value={fulfilledCount} hint="Shipped" />
          <StatCard
            label="Gross revenue"
            value={currency(activeAgg._sum.total ?? 0)}
            hint="Excl. refunds"
          />
          <StatCard
            label="Total commission"
            value={currency(activeAgg._sum.commission ?? 0)}
            hint="All active orders"
          />
        </div>

        <SectionCard title="All orders">
          <Suspense fallback={null}>
            <OrderFilters clinics={clinics} />
          </Suspense>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="font-medium px-5 py-2.5">Order</th>
                  <th className="font-medium py-2.5">Customer</th>
                  <th className="font-medium py-2.5">Clinic</th>
                  <th className="font-medium py-2.5">Items</th>
                  <th className="font-medium py-2.5 text-right">Total</th>
                  <th className="font-medium py-2.5 text-right">Commission</th>
                  <th className="font-medium py-2.5">Status</th>
                  <th className="font-medium py-2.5 pr-5">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                      No orders match your filters.
                    </td>
                  </tr>
                )}
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-5 py-2.5">
                      <span className="font-mono text-xs font-medium">
                        {o.number}
                      </span>
                    </td>
                    <td className="py-2.5">{o.customerName ?? "—"}</td>
                    <td className="py-2.5">
                      <div className="text-xs font-medium">{o.clinic.code}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {o.clinic.name}
                      </div>
                    </td>
                    <td className="py-2.5 tabular-nums">{o.items}</td>
                    <td className="py-2.5 text-right tabular-nums font-medium">
                      {currency(o.total)}
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-muted-foreground">
                      {currency(o.commission)}
                    </td>
                    <td className="py-2.5">
                      <StatusPill tone={statusTone[o.status] ?? "muted"}>
                        {o.status}
                      </StatusPill>
                    </td>
                    <td className="py-2.5 pr-5 text-xs text-muted-foreground">
                      {relativeTime(o.shopifyCreatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </PageBody>
    </>
  );
}
