import { Download, Filter, Search, ShoppingBag } from "lucide-react";
import { PageHeader, PageBody } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { orders } from "@/lib/mock";
import { currency, relativeTime } from "@/lib/utils";

export const metadata = { title: "Orders" };

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

export default function OrdersPage() {
  const fulfilled = orders.filter((o) => o.status === "fulfilled").length;
  const totalRevenue = orders
    .filter((o) => o.status !== "refunded" && o.status !== "cancelled")
    .reduce((a, o) => a + o.total, 0);
  const totalCommission = orders
    .filter((o) => o.status !== "refunded" && o.status !== "cancelled")
    .reduce((a, o) => a + o.commission, 0);

  return (
    <>
      <PageHeader
        title="Orders"
        description="All Shopify orders across all clinic codes."
        actions={
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4" />
            Export
          </Button>
        }
      />
      <PageBody>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total orders"
            value={orders.length}
            hint="All time"
            icon={<ShoppingBag className="h-4 w-4" />}
          />
          <StatCard
            label="Fulfilled"
            value={fulfilled}
            hint="Shipped"
            delta={{ value: "+8.2%", positive: true }}
          />
          <StatCard
            label="Gross revenue"
            value={currency(totalRevenue)}
            hint="Excl. refunds"
          />
          <StatCard
            label="Total commission"
            value={currency(totalCommission)}
            hint="All active orders"
          />
        </div>

        <SectionCard title="All orders">
          {/* Toolbar */}
          <div className="flex items-center gap-2 px-5 py-3 border-b border-border flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                placeholder="Search orders, clinics…"
                className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </div>
            <Button variant="outline" size="sm">
              <Filter className="h-3.5 w-3.5" />
              Status
            </Button>
            <Button variant="outline" size="sm">
              <Filter className="h-3.5 w-3.5" />
              Clinic
            </Button>
            <Button variant="outline" size="sm">
              <Filter className="h-3.5 w-3.5" />
              Date range
            </Button>
          </div>

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
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-5 py-2.5">
                      <span className="font-mono text-xs font-medium">
                        {o.number}
                      </span>
                    </td>
                    <td className="py-2.5">{o.customer}</td>
                    <td className="py-2.5">
                      <div className="text-xs font-medium">{o.clinicCode}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {o.clinicName}
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
                      {relativeTime(o.createdAt)}
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
