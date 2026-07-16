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
import {
  clinics,
  orders,
  monthlyRevenue,
  commissions,
  ordersByProduct,
} from "@/lib/mock";
import { currency, dateFmt, relativeTime } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

export default function DashboardPage() {
  const activeClinics = clinics.filter((c) => c.status === "active").length;
  const pendingApprovals = clinics.filter((c) => c.status === "pending").length;
  const currentMonthRevenue = monthlyRevenue[monthlyRevenue.length - 1].revenue;
  const prevMonthRevenue = monthlyRevenue[monthlyRevenue.length - 2].revenue;
  const revenueGrowth = (
    ((currentMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100
  ).toFixed(1);
  const totalCommissionPayable = commissions
    .filter((c) => c.status === "payable")
    .reduce((a, b) => a + b.commission, 0);
  const totalOrdersMtd = orders.filter((o) => {
    const d = new Date(o.createdAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const recentOrders = orders.slice(0, 6);
  const latestClinics = clinics.slice(0, 5);
  const pendingClinics = clinics.filter((c) => c.status === "pending");

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
            value={activeClinics}
            hint={`${pendingApprovals} pending approval`}
            delta={{ value: "+3 this month", positive: true }}
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
            value={totalOrdersMtd}
            hint="Shopify orders"
            delta={{ value: "+12.4%", positive: true }}
            icon={<ShoppingBag className="h-4 w-4" />}
          />
          <StatCard
            label="Commission payable"
            value={currency(totalCommissionPayable)}
            hint="Ready for invoicing"
            icon={<Percent className="h-4 w-4" />}
          />
        </div>

        {/* Revenue chart + Pending approvals */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SectionCard title="Monthly revenue & commission" className="lg:col-span-2">
            <Suspense fallback={<Skeleton className="h-72 m-4" />}>
              <RevenueChart data={monthlyRevenue} />
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
                          {relativeTime(o.createdAt)}
                        </div>
                      </td>
                      <td className="py-2.5 text-xs font-medium">{o.clinicCode}</td>
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
              <RevenueChart data={monthlyRevenue} />
            </Suspense>
          </SectionCard>
          <SectionCard title="Orders by product">
            <Suspense fallback={<Skeleton className="h-72 m-4" />}>
              <OrdersByProductChart data={ordersByProduct} />
            </Suspense>
          </SectionCard>
        </div>

        {/* Integration health */}
        <SectionCard title="Integration health">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border">
            {[
              { name: "Shopify", status: "Connected", detail: "Last sync 2m ago · clinicdirect.myshopify.com", ok: true },
              { name: "Database", status: "Connected", detail: "MongoDB Atlas · All collections healthy", ok: true },
              { name: "Microsoft Clarity", status: "Active", detail: "Tracking 5 pages on clinicdirect.co.uk", ok: true },
            ].map((int) => (
              <div key={int.name} className="bg-card p-5">
                <div className="flex items-center gap-2 mb-2">
                  {int.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span className="font-medium text-sm">{int.name}</span>
                  <StatusPill tone={int.ok ? "success" : "destructive"} className="ml-auto">
                    {int.status}
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
