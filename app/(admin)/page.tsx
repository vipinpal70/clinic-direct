import { Suspense } from "react";
import {
  Building2,
  ShoppingBag,
  Percent,
  TrendingUp,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { PageHeader, PageBody } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { SectionCard } from "@/components/shared/section-card";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RevenueChart, OrdersByProductChart } from "./dashboard-charts";
import { prisma } from "@/lib/prisma";
import { getClinicsWithStats, getDashboardStats } from "@/lib/stats";
import { currency, dateFmt, relativeTime } from "@/lib/utils";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [clinics, stats, recentOrders, integrations] = await Promise.all([
    getClinicsWithStats(),
    getDashboardStats(),
    prisma.order.findMany({
      orderBy: { shopifyCreatedAt: "desc" },
      take: 6,
      include: { clinic: { select: { name: true, code: true } } },
    }),
    prisma.integrationConfig.findMany(),
  ]);

  const currentMonthRevenue = stats.monthlyRevenue[stats.monthlyRevenue.length - 1]?.revenue ?? 0;
  const prevMonthRevenue = stats.monthlyRevenue[stats.monthlyRevenue.length - 2]?.revenue ?? 0;
  const revenueGrowth = prevMonthRevenue
    ? (((currentMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100).toFixed(1)
    : "0.0";

  const latestClinics = clinics.slice(0, 5);
  const pendingClinics = clinics.filter((c) => c.status === "pending");

  const integrationHealth = [
    {
      name: "Shopify",
      ok: integrations.find((i) => i.provider === "shopify")?.active ?? false,
      detail: integrations.find((i) => i.provider === "shopify")?.lastSyncAt
        ? `Last sync ${relativeTime(integrations.find((i) => i.provider === "shopify")!.lastSyncAt!)}`
        : "Not yet synced",
    },
    { name: "Database", ok: true, detail: "MongoDB · connected via Prisma" },
    {
      name: "Microsoft Clarity",
      ok: integrations.find((i) => i.provider === "clarity")?.active ?? false,
      detail: "Tracking on clinicdirect.co.uk",
    },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Operational overview of clinics, commissions, orders and integration health."
      />
      <PageBody>
        {/* KPI Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Active clinics"
            value={clinics.filter((c) => c.status === "active").length}
            hint={`${pendingClinics.length} pending approval`}
            icon={<Building2 className="h-4 w-4" />}
          />
          <StatCard
            label="Revenue MTD"
            value={currency(currentMonthRevenue)}
            hint="vs last month"
            delta={{ value: `${revenueGrowth}%`, positive: parseFloat(revenueGrowth) > 0 }}
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <StatCard
            label="Orders MTD"
            value={stats.ordersMtd}
            hint="Shopify orders"
            icon={<ShoppingBag className="h-4 w-4" />}
          />
          <StatCard
            label="Commission payable"
            value={currency(stats.totalCommissionPayable)}
            hint="Ready for invoicing"
            icon={<Percent className="h-4 w-4" />}
          />
        </div>

        {/* Revenue chart + Pending approvals */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SectionCard title="Monthly revenue & commission" className="lg:col-span-2">
            <Suspense fallback={<Skeleton className="h-72 m-4" />}>
              <RevenueChart data={stats.monthlyRevenue} />
            </Suspense>
          </SectionCard>

          <SectionCard
            title="Pending approvals"
            description={`${pendingClinics.length} clinics awaiting review`}
            actions={
              <Button variant="ghost" size="sm" asChild>
                <Link href="/approvals">
                  View all <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            }
          >
            <div className="divide-y divide-border">
              {pendingClinics.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <CheckCircle2 className="h-8 w-8 text-success/60" />
                  <p className="text-sm text-muted-foreground">All caught up!</p>
                </div>
              )}
              {pendingClinics.slice(0, 4).map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center text-[11px] font-bold text-accent-foreground shrink-0">
                    {c.code.slice(-3)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Joined {dateFmt(c.joined)}
                    </div>
                  </div>
                  <StatusPill
                    tone={
                      c.agreement === "accepted" ? "success"
                      : c.agreement === "viewed" ? "info"
                      : c.agreement === "sent" ? "warning"
                      : "muted"
                    }
                  >
                    {c.agreement.replace("_", " ")}
                  </StatusPill>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        {/* Recent orders + Latest clinics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SectionCard
            title="Recent orders"
            actions={
              <Button variant="ghost" size="sm" asChild>
                <Link href="/orders">View all <ArrowRight className="h-3.5 w-3.5" /></Link>
              </Button>
            }
          >
            {recentOrders.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No orders yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-border">
                      <th className="font-medium px-5 py-2.5">Order</th>
                      <th className="font-medium py-2.5">Clinic</th>
                      <th className="font-medium py-2.5 text-right">Total</th>
                      <th className="font-medium py-2.5 pr-5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {recentOrders.map((o) => (
                      <tr key={o.id} className="hover:bg-muted/40 transition-colors">
                        <td className="px-5 py-2.5">
                          <div className="font-mono text-xs font-medium">{o.number}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {relativeTime(o.shopifyCreatedAt)}
                          </div>
                        </td>
                        <td className="py-2.5 text-xs font-medium">{o.clinic.code}</td>
                        <td className="py-2.5 text-right tabular-nums font-medium">
                          {currency(o.total)}
                        </td>
                        <td className="py-2.5 pr-5">
                          <OrderStatusPill status={o.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Latest clinics"
            actions={
              <Button variant="ghost" size="sm" asChild>
                <Link href="/clinics">View all <ArrowRight className="h-3.5 w-3.5" /></Link>
              </Button>
            }
          >
            <div className="divide-y divide-border">
              {latestClinics.map((c) => (
                <Link
                  key={c.id}
                  href={`/clinics/${c.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary shrink-0">
                    {c.code.slice(-3)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.code} · {c.ordersMtd} orders MTD
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold tabular-nums">
                      {currency(c.monthSales)}
                    </div>
                    <StatusPill
                      tone={
                        c.status === "active" ? "success"
                        : c.status === "pending" ? "warning"
                        : c.status === "suspended" ? "destructive"
                        : "muted"
                      }
                    >
                      {c.status}
                    </StatusPill>
                  </div>
                </Link>
              ))}
            </div>
          </SectionCard>
        </div>

        {/* ── Report charts ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SectionCard title="Monthly sales trend">
            <Suspense fallback={<Skeleton className="h-72 m-4" />}>
              <RevenueChart data={stats.monthlyRevenue} />
            </Suspense>
          </SectionCard>
          <SectionCard title="Orders by product">
            <Suspense fallback={<Skeleton className="h-72 m-4" />}>
              <OrdersByProductChart data={stats.ordersByProduct} />
            </Suspense>
          </SectionCard>
        </div>

        {/* Integration health */}
        <SectionCard title="Integration health">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border">
            {integrationHealth.map((int) => (
              <div key={int.name} className="bg-card p-5">
                <div className="flex items-center gap-2 mb-2">
                  {int.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span className="font-medium text-sm">{int.name}</span>
                  <StatusPill tone={int.ok ? "success" : "destructive"} className="ml-auto">
                    {int.ok ? "Connected" : "Inactive"}
                  </StatusPill>
                </div>
                <p className="text-xs text-muted-foreground">{int.detail}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </PageBody>
    </>
  );
}

function OrderStatusPill({ status }: { status: string }) {
  const toneMap: Record<string, "success" | "warning" | "destructive" | "info" | "muted"> = {
    fulfilled: "success",
    processing: "info",
    pending: "warning",
    refunded: "destructive",
    cancelled: "muted",
  };
  return <StatusPill tone={toneMap[status] ?? "muted"}>{status}</StatusPill>;
}
