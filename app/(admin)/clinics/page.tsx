import { Suspense } from "react";
import { Building2 } from "lucide-react";
import Link from "next/link";
import { PageHeader, PageBody } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { getClinicsWithStats } from "@/lib/stats";
import { currency, dateFmt } from "@/lib/utils";
import type { ClinicStatus } from "@/types";
import { AddClinicDialog } from "./add-clinic-dialog";
import { ClinicFilters } from "./clinic-filters";
import { ImportExportButtons } from "./import-export-buttons";

export const metadata = { title: "Clinics" };
export const dynamic = "force-dynamic";

const statusTone: Record<ClinicStatus, "success" | "warning" | "destructive" | "muted"> = {
  active: "success",
  pending: "warning",
  suspended: "destructive",
  inactive: "muted",
};

interface Props {
  searchParams: Promise<{ search?: string; status?: string }>;
}

export default async function ClinicsPage({ searchParams }: Props) {
  const { search, status } = await searchParams;
  const allClinics = await getClinicsWithStats();

  const active = allClinics.filter((c) => c.status === "active");
  const pending = allClinics.filter((c) => c.status === "pending");
  const totalRevenue = allClinics.reduce((a, c) => a + c.monthSales, 0);

  let clinics = allClinics;
  if (status) clinics = clinics.filter((c) => c.status === status);
  if (search) {
    const q = search.toLowerCase();
    clinics = clinics.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q),
    );
  }

  return (
    <>
      <PageHeader
        title="Clinics"
        description="All registered clinics and their portal links, orders and commission status."
        actions={
          <>
            <ImportExportButtons />
            <AddClinicDialog />
          </>
        }
      />
      <PageBody>
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total clinics" value={allClinics.length} hint="All registered" icon={<Building2 className="h-4 w-4" />} />
          <StatCard label="Active" value={active.length} hint="Generating orders" />
          <StatCard label="Pending approval" value={pending.length} hint="Awaiting review" />
          <StatCard label="Revenue MTD" value={currency(totalRevenue)} hint="Combined sales" />
        </div>

        <SectionCard title="All clinics">
          <Suspense fallback={null}>
            <ClinicFilters />
          </Suspense>

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
                {clinics.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                      No clinics match your filters.
                    </td>
                  </tr>
                )}
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
