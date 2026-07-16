import { MonitorDot, ExternalLink, RefreshCw } from "lucide-react";
import { PageHeader, PageBody } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Microsoft Clarity" };

const PAGES_TRACKED = [
  { path: "/shop", sessions: 2840, heatmap: true, recordings: 142 },
  { path: "/products/mounjaro", sessions: 1920, heatmap: true, recordings: 98 },
  { path: "/portal", sessions: 1140, heatmap: true, recordings: 61 },
  { path: "/checkout", sessions: 880, heatmap: true, recordings: 54 },
  { path: "/", sessions: 3200, heatmap: true, recordings: 210 },
];

export default function ClarityPage() {
  return (
    <>
      <PageHeader
        title="Microsoft Clarity"
        description="Heatmaps, session recordings and user behaviour analytics."
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <a href="https://clarity.microsoft.com" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                Open Clarity
              </a>
            </Button>
            <Button size="sm">
              <RefreshCw className="h-4 w-4" />
              Refresh stats
            </Button>
          </>
        }
      />
      <PageBody>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Status"
            value="Active"
            hint="Tracking enabled"
            icon={<MonitorDot className="h-4 w-4" />}
          />
          <StatCard label="Sessions (30d)" value="12,840" hint="Unique sessions" delta={{ value: "+14.2%", positive: true }} />
          <StatCard label="Recordings" value="565" hint="This month" />
          <StatCard label="Pages tracked" value={PAGES_TRACKED.length} hint="With heatmaps" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SectionCard title="Integration settings">
            <div className="p-5 space-y-4">
              <Field label="Project ID" value="cd-admin-01" />
              <Field label="Tracking domain" value="clinicdirect.co.uk" />
              <Field label="Script version" value="0.7.1" />
              <Field label="Data retention" value="90 days" />
              <Field label="IP masking" value="Enabled" />
              <Field label="Cookie consent" value="Required" />
              <div className="flex items-center gap-2 pt-2">
                <StatusPill tone="success">Tracking active</StatusPill>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Snippet">
            <div className="p-5">
              <p className="text-xs text-muted-foreground mb-3">
                Paste this snippet in your <code className="font-mono">&lt;head&gt;</code> to enable tracking.
              </p>
              <pre className="bg-muted rounded-lg p-4 text-xs font-mono overflow-x-auto text-foreground">
{`<script type="text/javascript">
  (function(c,l,a,r,i,t,y){
    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
  })(window, document, "clarity", "script", "cd-admin-01");
</script>`}
              </pre>
              <Button variant="outline" size="sm" className="mt-3">
                Copy snippet
              </Button>
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Pages with heatmaps">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="font-medium px-5 py-2.5">Page</th>
                  <th className="font-medium py-2.5 text-right">Sessions</th>
                  <th className="font-medium py-2.5 text-right">Recordings</th>
                  <th className="font-medium py-2.5 pr-5">Heatmap</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {PAGES_TRACKED.map((p) => (
                  <tr key={p.path} className="hover:bg-muted/40 transition-colors">
                    <td className="px-5 py-2.5 font-mono text-xs">{p.path}</td>
                    <td className="py-2.5 text-right tabular-nums">{p.sessions.toLocaleString()}</td>
                    <td className="py-2.5 text-right tabular-nums">{p.recordings}</td>
                    <td className="py-2.5 pr-5">
                      <StatusPill tone={p.heatmap ? "success" : "muted"}>
                        {p.heatmap ? "Available" : "No data"}
                      </StatusPill>
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
