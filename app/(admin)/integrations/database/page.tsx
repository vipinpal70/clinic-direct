import { Database, CheckCircle2, AlertCircle } from "lucide-react";
import { PageHeader, PageBody } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { getDatabaseStats } from "@/lib/database-stats";

export const metadata = { title: "Database" };
export const dynamic = "force-dynamic";

export default async function DatabasePage() {
  const stats = await getDatabaseStats();
  const clusterHost = getClusterHost(process.env.DATABASE_URL);

  return (
    <>
      <PageHeader
        title="Database"
        description="MongoDB connection status, collections and indexes."
      />
      <PageBody>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Connection"
            value={stats.healthy ? "Connected" : "Unreachable"}
            hint="MongoDB"
            icon={<Database className="h-4 w-4" />}
          />
          <StatCard label="Collections" value={stats.collections.length} hint="Active collections" />
          <StatCard label="Total documents" value={stats.totalDocuments} hint="Across all collections" />
          <StatCard label="Provider" value="MongoDB Atlas" hint="via Prisma" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SectionCard title="Connection settings">
            <div className="p-5 space-y-4">
              <Field label="Provider" value="MongoDB" />
              <Field label="Cluster" value={clusterHost} mono />
              <Field label="Database" value="clinic-admin" />
              <div className="flex items-center gap-2 pt-2">
                {stats.healthy ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span className="text-sm text-success font-medium">Connection healthy</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <span className="text-sm text-destructive font-medium">Connection unreachable</span>
                  </>
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="About backups">
            <div className="p-5 space-y-3 text-sm text-muted-foreground">
              <p>
                Backups for MongoDB Atlas clusters are managed directly in the
                Atlas console (continuous cloud backups, point-in-time
                restore), not through this admin panel.
              </p>
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Collections">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="font-medium px-5 py-2.5">Collection</th>
                  <th className="font-medium py-2.5 text-right">Documents</th>
                  <th className="font-medium py-2.5 text-right">Size</th>
                  <th className="font-medium py-2.5 text-right pr-5">Indexes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stats.collections.map((c) => (
                  <tr key={c.name} className="hover:bg-muted/40 transition-colors">
                    <td className="px-5 py-2.5 font-mono text-xs font-medium">{c.name}</td>
                    <td className="py-2.5 text-right tabular-nums">{c.documents}</td>
                    <td className="py-2.5 text-right text-muted-foreground">{c.size}</td>
                    <td className="py-2.5 text-right tabular-nums pr-5">{c.indexes}</td>
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

function getClusterHost(dbUrl: string | undefined): string {
  if (!dbUrl) return "not configured";
  try {
    return new URL(dbUrl.replace(/^mongodb(\+srv)?/, "https")).host;
  } catch {
    return "unknown";
  }
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="text-muted-foreground">{label}</div>
      <div className={mono ? "font-mono text-xs" : "font-medium"}>{value}</div>
    </div>
  );
}
