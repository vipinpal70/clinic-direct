import { Download } from "lucide-react";
import { PageHeader, PageBody } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { currency, currencyExact, dateFmt } from "@/lib/utils";
import type { InvoiceStatus } from "@/types";
import { GenerateInvoicesButton, PushQueuedButton } from "./invoice-actions";

export const metadata = { title: "Self-billed invoices" };
export const dynamic = "force-dynamic";

const statusTone: Record<
  InvoiceStatus,
  "success" | "warning" | "destructive" | "info" | "muted"
> = {
  paid: "success",
  pushed: "info",
  issued: "warning",
  draft: "muted",
  voided: "destructive",
};

export default async function InvoicesPage() {
  const currentPeriod = new Date().toISOString().slice(0, 7);

  const invoices = await prisma.invoice.findMany({
    include: { clinic: { select: { name: true, code: true } } },
    orderBy: { createdAt: "desc" },
  });

  const total = invoices.reduce((a, b) => a + b.total, 0);
  const awaiting = invoices.filter((i) => i.status === "issued").length;
  const paid = invoices.filter((i) => i.status === "paid").length;

  return (
    <>
      <PageHeader
        title="Self-billed invoices"
        description="Auto-generated on behalf of clinics from commission runs. Push to Orderwise on approval."
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download, not a page navigation */}
              <a href="/api/invoices/export">
                <Download className="h-4 w-4" />
                Export CSV
              </a>
            </Button>
            <GenerateInvoicesButton period={currentPeriod} />
            <PushQueuedButton />
          </>
        }
      />
      <PageBody>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Invoices total" value={invoices.length} />
          <StatCard label="Total billed" value={currency(total)} />
          <StatCard label="Awaiting push" value={awaiting} />
          <StatCard label="Paid" value={paid} />
        </div>

        <SectionCard>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="font-medium px-5 py-2.5">Invoice</th>
                  <th className="font-medium py-2.5">Date</th>
                  <th className="font-medium py-2.5">Clinic</th>
                  <th className="font-medium py-2.5 text-right">Commission</th>
                  <th className="font-medium py-2.5 text-right">VAT</th>
                  <th className="font-medium py-2.5 text-right">Total</th>
                  <th className="font-medium py-2.5">Status</th>
                  <th className="font-medium py-2.5 pr-5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                      No invoices yet — generate them from approved commissions.
                    </td>
                  </tr>
                )}
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs font-medium">
                      {inv.number}
                    </td>
                    <td className="py-3 text-sm">{dateFmt(inv.createdAt)}</td>
                    <td className="py-3">{inv.clinic.name}</td>
                    <td className="py-3 text-right tabular-nums">
                      {currencyExact(inv.commission)}
                    </td>
                    <td className="py-3 text-right tabular-nums">
                      {currencyExact(inv.vat)}
                    </td>
                    <td className="py-3 text-right tabular-nums font-semibold">
                      {currencyExact(inv.total)}
                    </td>
                    <td className="py-3">
                      <StatusPill tone={statusTone[inv.status as InvoiceStatus]}>
                        {inv.status}
                      </StatusPill>
                    </td>
                    <td className="py-3 pr-5 text-right">
                      <a
                        href={`/api/invoices/${inv.id}`}
                        download={`${inv.number}.json`}
                        className="h-7 w-7 rounded-md hover:bg-accent inline-flex items-center justify-center text-muted-foreground transition-colors"
                        aria-label="Download invoice data"
                      >
                        <Download className="h-4 w-4" />
                      </a>
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
