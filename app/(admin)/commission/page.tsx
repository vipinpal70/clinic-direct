import { PageHeader, PageBody } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { StatusPill } from "@/components/shared/status-pill";
import { prisma } from "@/lib/prisma";
import { currency } from "@/lib/utils";
import { RuleDialog } from "./rule-dialog";
import { RecalculateButton } from "./recalculate-button";

export const metadata = { title: "Commission" };
export const dynamic = "force-dynamic";

const statusTone: Record<
  string,
  "success" | "warning" | "destructive" | "info" | "muted"
> = {
  approved: "success",
  payable: "warning",
  paid: "info",
  cancelled: "muted",
};

export default async function CommissionPage() {
  const currentPeriod = new Date().toISOString().slice(0, 7);

  const [rules, commissions, totals] = await Promise.all([
    prisma.commissionRule.findMany({
      where: { basis: "percentage" },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    }),
    prisma.commission.findMany({
      where: { period: currentPeriod },
      include: { clinic: { select: { name: true, code: true } } },
      orderBy: { commission: "desc" },
    }),
    prisma.commission.groupBy({
      by: ["status"],
      _sum: { commission: true },
    }),
  ]);

  const sumFor = (status: string) =>
    totals.find((t) => t.status === status)?._sum.commission ?? 0;
  const payable = sumFor("payable");
  const approved = sumFor("approved");
  const paid = sumFor("paid");
  const cancelled = sumFor("cancelled");
  const total = payable + approved + paid;

  return (
    <>
      <PageHeader
        title="Commission engine"
        description="Percentage-based rules by clinic, product or category. Handles VAT, refunds and renewals."
        actions={
          <>
            <RecalculateButton period={currentPeriod} />
            <RuleDialog />
          </>
        }
      />
      <PageBody>
        {/* Summary KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Payable" value={currency(payable)} hint="Ready for invoicing" />
          <StatCard label="Approved" value={currency(approved)} hint="Awaiting payment" />
          <StatCard label="Paid" value={currency(paid)} hint="All time" />
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
            <p className="text-sm text-muted-foreground">Clinics this period</p>
            <p className="text-2xl font-bold font-display">{commissions.length}</p>
          </div>
        </div>

        {/* Rules — percentage only */}
        <SectionCard
          title="Commission rules"
          description="Percentage-based · Applied in order, most specific first"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="font-medium px-5 py-2.5">Scope</th>
                  <th className="font-medium py-2.5">Rate</th>
                  <th className="font-medium py-2.5">Applies to</th>
                  <th className="font-medium py-2.5">Status</th>
                  <th className="font-medium py-2.5 pr-5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rules.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                      No percentage rules configured yet.
                    </td>
                  </tr>
                )}
                {rules.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-5 py-3 font-medium">{r.scopeLabel}</td>
                    <td className="py-3 tabular-nums font-semibold text-primary">
                      {r.value}%
                    </td>
                    <td className="py-3 text-muted-foreground">{r.appliesToLabel}</td>
                    <td className="py-3">
                      <StatusPill tone={r.active ? "success" : "muted"}>
                        {r.active ? "active" : "inactive"}
                      </StatusPill>
                    </td>
                    <td className="py-3 pr-5 text-right">
                      <RuleDialog rule={r} />
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
          description={`Billing period ${currentPeriod}`}
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
                {commissions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                      No commission run for this period yet — click Recalculate.
                    </td>
                  </tr>
                )}
                {commissions.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-5 py-3">
                      <div className="font-medium">{c.clinic.name}</div>
                      <div className="text-xs text-muted-foreground">{c.clinic.code}</div>
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
              {commissions.length > 0 && (
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
              )}
            </table>
          </div>
        </SectionCard>
      </PageBody>
    </>
  );
}
