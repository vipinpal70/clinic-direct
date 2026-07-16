import {
  Building2,
  Plus,
  Search,
  Download,
  Upload,
  Filter,
} from "lucide-react";
import Link from "next/link";
import { PageHeader, PageBody } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { clinics } from "@/lib/mock";
import { currency, dateFmt } from "@/lib/utils";
import type { ClinicStatus } from "@/types";

export const metadata = { title: "Clinics" };

const statusTone: Record<ClinicStatus, "success" | "warning" | "destructive" | "muted"> = {
  active: "success",
  pending: "warning",
  suspended: "destructive",
  inactive: "muted",
};

export default function ClinicsPage() {
  const active = clinics.filter((c) => c.status === "active");
  const pending = clinics.filter((c) => c.status === "pending");
  const totalRevenue = clinics.reduce((a, c) => a + c.monthSales, 0);

  return (
    <>
      <PageHeader
        title="Clinics"
        description="All registered clinics and their portal links, orders and commission status."
        actions={
          <>
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4" />
              Import
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Add clinic
            </Button>
          </>
        }
      />
      <PageBody>
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total clinics" value={clinics.length} hint="All registered" icon={<Building2 className="h-4 w-4" />} />
          <StatCard label="Active" value={active.length} hint="Generating orders" delta={{ value: "+3 this month", positive: true }} />
          <StatCard label="Pending approval" value={pending.length} hint="Awaiting review" />
          <StatCard label="Revenue MTD" value={currency(totalRevenue)} hint="Combined sales" delta={{ value: "+8.2%", positive: true }} />
        </div>

        <SectionCard title="All clinics">
          {/* Filters bar */}
          <div className="flex items-center gap-2 px-5 py-3 border-b border-border flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                placeholder="Search clinics…"
                className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </div>
            <Button variant="outline" size="sm">
              <Filter className="h-3.5 w-3.5" />
              Status
            </Button>
            <Button variant="outline" size="sm">
              <Filter className="h-3.5 w-3.5" />
              Commission
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="font-medium px-5 py-2.5">Clinic</th>
                  <th className="font-medium py-2.5">Code</th>
                  <th className="font-medium py-2.5">Status</th>
                  <th className="font-medium py-2.5 text-right">Orders MTD</th>
                  <th className="font-medium py-2.5 text-right">Sales MTD</th>
                  <th className="font-medium py-2.5 text-right">Commission</th>
                  <th className="font-medium py-2.5">Joined</th>
                  <th className="font-medium py-2.5 pr-5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {clinics.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary shrink-0">
                          {c.code.slice(-3)}
                        </div>
                        <div>
                          <Link
                            href={`/clinics/${c.id}`}
                            className="font-medium hover:text-primary transition-colors"
                          >
                            {c.name}
                          </Link>
                          <div className="text-xs text-muted-foreground">
                            {c.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 font-mono text-xs">{c.code}</td>
                    <td className="py-3">
                      <StatusPill tone={statusTone[c.status]}>
                        {c.status}
                      </StatusPill>
                    </td>
                    <td className="py-3 text-right tabular-nums">{c.ordersMtd}</td>
                    <td className="py-3 text-right tabular-nums">
                      {currency(c.monthSales)}
                    </td>
                    <td className="py-3 text-right tabular-nums text-muted-foreground">
                      {c.commissionPct}%
                    </td>
                    <td className="py-3 text-muted-foreground text-xs">
                      {dateFmt(c.joined)}
                    </td>
                    <td className="py-3 pr-5 text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/clinics/${c.id}`}>View</Link>
                      </Button>
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
