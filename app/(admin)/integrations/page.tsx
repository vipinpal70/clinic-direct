import Link from "next/link";
import { CheckCircle2, AlertCircle, ExternalLink, Store, Database, MonitorDot } from "lucide-react";
import { PageHeader, PageBody } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { getDatabaseStats } from "@/lib/database-stats";
import { relativeTime } from "@/lib/utils";

export const metadata = { title: "Integrations" };
export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const [configs, dbStats] = await Promise.all([
    prisma.integrationConfig.findMany(),
    getDatabaseStats(),
  ]);

  const shopify = configs.find((c) => c.provider === "shopify");
  const clarity = configs.find((c) => c.provider === "clarity");

  const integrations = [
    {
      name: "Shopify",
      description: "Storefront sync, webhooks and order processing",
      icon: Store,
      ok: shopify?.active ?? false,
      detail: shopify?.lastSyncAt
        ? `Last sync ${relativeTime(shopify.lastSyncAt)}`
        : "Not configured yet",
      href: "/integrations/shopify",
    },
    {
      name: "Database",
      description: "MongoDB — collections, indexes and connection health",
      icon: Database,
      ok: dbStats.healthy,
      detail: `${dbStats.totalDocuments} documents across ${dbStats.collections.length} collections`,
      href: "/integrations/database",
    },
    {
      name: "Microsoft Clarity",
      description: "Heatmaps, session recordings and user analytics",
      icon: MonitorDot,
      ok: clarity?.active ?? false,
      detail: clarity ? "Tracking configured" : "Not configured yet",
      href: "/integrations/clarity",
    },
  ];

  return (
    <>
      <PageHeader
        title="Integrations"
        description="Third-party service connections and data sync status."
      />
      <PageBody>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {integrations.map((int) => {
            const Icon = int.icon;
            return (
              <SectionCard key={int.name} className="hover:shadow-elevated transition-shadow">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <StatusPill tone={int.ok ? "success" : "muted"}>
                      {int.ok ? "connected" : "inactive"}
                    </StatusPill>
                  </div>
                  <h3 className="font-semibold mb-1">{int.name}</h3>
                  <p className="text-sm text-muted-foreground mb-1">
                    {int.description}
                  </p>
                  <p className="text-xs text-muted-foreground">{int.detail}</p>
                  <div className="mt-5">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={int.href}>
                        Configure
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </SectionCard>
            );
          })}
        </div>

        <SectionCard title="Integration health">
          <div className="divide-y divide-border">
            {integrations.map((s) => (
              <div key={s.name} className="flex items-center gap-4 px-5 py-4">
                {s.ok ? (
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <div className="flex-1 font-medium text-sm">{s.name}</div>
                <StatusPill tone={s.ok ? "success" : "muted"}>
                  {s.ok ? "Operational" : "Inactive"}
                </StatusPill>
                <div className="text-xs text-muted-foreground hidden md:block">
                  {s.detail}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </PageBody>
    </>
  );
}
