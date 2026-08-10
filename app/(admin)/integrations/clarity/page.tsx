import { MonitorDot, ExternalLink } from "lucide-react";
import { PageHeader, PageBody } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { ClarityConfigForm } from "./clarity-config-form";
import { CopySnippetButton } from "./copy-snippet-button";

export const metadata = { title: "Microsoft Clarity" };
export const dynamic = "force-dynamic";

interface ClarityConfig {
  projectId?: string;
  trackingDomain?: string;
}

export default async function ClarityPage() {
  const config = await prisma.integrationConfig.findUnique({ where: { provider: "clarity" } });
  const settings = (config?.config as ClarityConfig | undefined) ?? {};
  const projectId = settings.projectId ?? "";
  const trackingDomain = settings.trackingDomain ?? "";
  const active = config?.active ?? false;

  const snippet = `<script type="text/javascript">
  (function(c,l,a,r,i,t,y){
    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
  })(window, document, "clarity", "script", "${projectId || "YOUR_PROJECT_ID"}");
</script>`;

  return (
    <>
      <PageHeader
        title="Microsoft Clarity"
        description="Heatmaps, session recordings and user behaviour analytics."
        actions={
          <Button variant="outline" size="sm" asChild>
            <a href="https://clarity.microsoft.com" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              Open Clarity dashboard
            </a>
          </Button>
        }
      />
      <PageBody>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Status"
            value={active ? "Active" : "Inactive"}
            hint={active ? "Tracking enabled" : "Not configured"}
            icon={<MonitorDot className="h-4 w-4" />}
          />
          <StatCard label="Project ID" value={projectId || "—"} hint="Clarity project" />
          <StatCard label="Tracking domain" value={trackingDomain || "—"} hint="Site domain" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SectionCard title="Integration settings">
            <ClarityConfigForm
              projectId={projectId}
              trackingDomain={trackingDomain}
              active={active}
            />
          </SectionCard>

          <SectionCard title="Snippet">
            <div className="p-5">
              <p className="text-xs text-muted-foreground mb-3">
                Paste this snippet in your <code className="font-mono">&lt;head&gt;</code> to enable tracking.
              </p>
              <pre className="bg-muted rounded-lg p-4 text-xs font-mono overflow-x-auto text-foreground">
                {snippet}
              </pre>
              <CopySnippetButton snippet={snippet} />
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Live analytics">
          <div className="p-5 text-sm text-muted-foreground">
            Session recordings, heatmaps and page-level analytics are viewed
            directly in the{" "}
            <a
              href="https://clarity.microsoft.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Microsoft Clarity dashboard
            </a>{" "}
            — Clarity doesn&apos;t expose that data through a write-back API,
            so it isn&apos;t duplicated here.
          </div>
        </SectionCard>
      </PageBody>
    </>
  );
}
