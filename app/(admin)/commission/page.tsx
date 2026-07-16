import { Plus, Settings2 } from "lucide-react";
import { PageHeader, PageBody } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { commissions, commissionRules } from "@/lib/mock";
import { currency } from "@/lib/utils";

export const metadata = { title: "Commission" };

const statusTone: Record<
  string,
  "success" | "warning" | "destructive" | "info" | "muted"
> = {
  approved: "success",
  payable: "warning",
  paid: "info",
  cancelled: "muted",
};

// Percentage-only rules (filter out any fixed-basis rules)
const percentageRules = commissionRules.filter((r) => r.basis === "Percentage");

export default function CommissionPage() {
  const payable = commissions
    .filter((c) => c.status === "payable")
    .reduce((a, c) => a + c.commission, 0);
  const approved = commissions
    .filter((c) => c.status === "approved")
    .reduce((a, c) => a + c.commission, 0);
  const paid = commissions
    .filter((c) => c.status === "paid")
    .reduce((a, c) => a + c.commission, 0);
  const cancelled = commissions
    .filter((c) => c.status === "cancelled")
    .reduce((a, c) => a + c.commission, 0);
  const total = payable + approved + paid;

  return (
    <>
      <PageHeader
        title="Commission engine"
        description="Percentage-based rules by clinic, product or category. Handles VAT, refunds and renewals."
        actions={
          <>
            <Button variant="outline" size="sm">
              <Settings2 className="h-4 w-4" />
              Recalculate
            </Button>
            <Button size="sm">
              <Plus className="h-4 w-4" />
              New rule
            </Button>
          </>
        }
      />
      <PageBody>
        {/* Summary KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Payable" value={currency(payable)} hint="Ready for invoicing" />
          <StatCard label="Approved" value={currency(approved)} hint="Awaiting payment" />
          <StatCard label="Paid MTD" value={currency(paid)} hint="This month" />
          <StatCard label="Cancelled" value={currency(cancelled)} hint="Refunds & voids" />
        </div>

        {/* Total commission banner */}
        <div className="rounded-xl border border-border bg-primary/5 px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Total commission (all time)</p>
            <p className="text-2xl font-bold font-display text-primary mt-0.5">
              {currency(total)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Active clinics</p>
            <p className="text-2xl font-bold font-display">{commissions.length}</p>
          </div>
        </div>

        {/* Rules — percentage only */}
        <SectionCard
          title="Commission rules"
          description="Percentage-based · Applied in order, most specific first"
          actions={
            <Button size="sm" variant="outline">
              <Plus className="h-3.5 w-3.5" />
              Add rule
            </Button>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="font-medium px-5 py-2.5">Scope</th>
                  <th className="font-medium py-2.5">Rate</th>
                  <th className="font-medium py-2.5">Applies to</th>
                  <th className="font-medium py-2.5 pr-5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {percentageRules.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-5 py-3 font-medium">{r.scope}</td>
                    <td className="py-3 tabular-nums font-semibold text-primary">
                      {r.value}
                    </td>
                    <td className="py-3 text-muted-foreground">{r.applies}</td>
                    <td className="py-3 pr-5">
                      <StatusPill tone="success">{r.status}</StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        {/* By clinic */}
        <SectionCard
          title="Commission by clinic"
          description="Current billing period"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="font-medium px-5 py-2.5">Clinic</th>
                  <th className="font-medium py-2.5 text-right">Gross sales</th>
                  <th className="font-medium py-2.5 text-right">Rate</th>
                  <th className="font-medium py-2.5 text-right">Commission</th>
                  <th className="font-medium py-2.5 pr-5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {commissions.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-5 py-3">
                      <div className="font-medium">{c.clinicName}</div>
                      <div className="text-xs text-muted-foreground">{c.clinicCode}</div>
                    </td>
                    <td className="py-3 text-right tabular-nums">{currency(c.gross)}</td>
                    <td className="py-3 text-right tabular-nums font-semibold text-primary">
                      {c.rate}%
                    </td>
                    <td className="py-3 text-right tabular-nums font-semibold">
                      {currency(c.commission)}
                    </td>
                    <td className="py-3 pr-5">
                      <StatusPill tone={statusTone[c.status] ?? "muted"}>
                        {c.status}
                      </StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/30">
                  <td className="px-5 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">
                    Total
                  </td>
                  <td className="py-3 text-right tabular-nums font-semibold">
                    {currency(commissions.reduce((a, c) => a + c.gross, 0))}
                  </td>
                  <td className="py-3" />
                  <td className="py-3 text-right tabular-nums font-bold text-primary">
                    {currency(commissions.reduce((a, c) => a + c.commission, 0))}
                  </td>
                  <td className="py-3 pr-5" />
                </tr>
              </tfoot>
            </table>
          </div>
        </SectionCard>
      </PageBody>
    </>
  );
}
