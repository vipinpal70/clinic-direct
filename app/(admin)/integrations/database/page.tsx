import { Database, RefreshCw, Download, CheckCircle2, AlertCircle } from "lucide-react";
import { PageHeader, PageBody } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Database" };

const COLLECTIONS = [
  { name: "clinics", documents: 10, size: "48 KB", indexes: 3 },
  { name: "orders", documents: 60, size: "210 KB", indexes: 5 },
  { name: "commissions", documents: 7, size: "18 KB", indexes: 4 },
  { name: "invoices", documents: 8, size: "22 KB", indexes: 3 },
  { name: "commission_rules", documents: 5, size: "8 KB", indexes: 2 },
  { name: "admin_users", documents: 6, size: "12 KB", indexes: 2 },
  { name: "audit_logs", documents: 8, size: "32 KB", indexes: 4 },
  { name: "webhook_logs", documents: 24, size: "86 KB", indexes: 3 },
];

const BACKUPS = [
  { date: "Today 03:12", size: "1.2 MB", status: "success", type: "Automatic" },
  { date: "Yesterday 03:10", size: "1.1 MB", status: "success", type: "Automatic" },
  { date: "2 days ago 03:08", size: "1.1 MB", status: "success", type: "Automatic" },
  { date: "3 days ago 14:22", size: "1.0 MB", status: "success", type: "Manual" },
];

export default function DatabasePage() {
  return (
    <>
      <PageHeader
        title="Database"
        description="MongoDB connection status, collections, indexes and backup management."
        actions={
          <>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4" />
              Download backup
            </Button>
            <Button size="sm">
              <RefreshCw className="h-4 w-4" />
              Run backup now
            </Button>
          </>
        }
      />
      <PageBody>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Connection"
            value="Connected"
            hint="MongoDB Atlas"
            icon={<Database className="h-4 w-4" />}
          />
          <StatCard label="Collections" value={COLLECTIONS.length} hint="Active collections" />
          <StatCard label="Total documents" value={COLLECTIONS.reduce((a, c) => a + c.documents, 0)} hint="Across all collections" />
          <StatCard label="Last backup" value="03:12" hint="Today · Retained 90 days" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SectionCard title="Connection settings">
            <div className="p-5 space-y-4">
              <Field label="Provider" value="MongoDB Atlas" />
              <Field label="Cluster" value="cluster0.xxxxx.mongodb.net" mono />
              <Field label="Database" value="clinic-admin" />
              <Field label="Connection pool" value="10 max connections" />
              <Field label="TLS/SSL" value="Enabled" />
              <div className="flex items-center gap-2 pt-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span className="text-sm text-success font-medium">Connection healthy</span>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Backup settings">
            <div className="p-5 space-y-4">
              <Field label="Schedule" value="Daily at 03:00 UTC" />
              <Field label="Retention" value="90 days" />
              <Field label="Storage" value="MongoDB Atlas Backup" />
              <Field label="Encryption" value="AES-256 at rest" />
              <div className="pt-2">
                <Button size="sm">Configure schedule</Button>
              </div>
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
                {COLLECTIONS.map((c) => (
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

        <SectionCard title="Backup history">
          <div className="divide-y divide-border">
            {BACKUPS.map((b, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3">
                {b.status === "success" ? (
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{b.date}</div>
                  <div className="text-xs text-muted-foreground">{b.type} · {b.size}</div>
                </div>
                <StatusPill tone={b.status === "success" ? "success" : "destructive"}>
                  {b.status}
                </StatusPill>
                <Button variant="ghost" size="sm">
                  <Download className="h-3.5 w-3.5" />
                  Download
                </Button>
              </div>
            ))}
          </div>
        </SectionCard>
      </PageBody>
    </>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="text-muted-foreground">{label}</div>
      <div className={mono ? "font-mono text-xs" : "font-medium"}>{value}</div>
    </div>
  );
}
