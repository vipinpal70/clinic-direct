import Link from "next/link";
import { CheckCircle2, ExternalLink, Store, Database, MonitorDot } from "lucide-react";
import { PageHeader, PageBody } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Integrations" };

const INTEGRATIONS = [
  {
    name: "Shopify",
    description: "Storefront sync, webhooks and order processing",
    icon: Store,
    status: "connected",
    detail: "clinicdirect.myshopify.com · Last sync 2m ago",
    href: "/integrations/shopify",
  },
  {
    name: "Database",
    description: "MongoDB Atlas — collections, indexes and backups",
    icon: Database,
    status: "connected",
    detail: "cluster0.xxxxx.mongodb.net · All healthy",
    href: "/integrations/database",
  },
  {
    name: "Microsoft Clarity",
    description: "Heatmaps, session recordings and user analytics",
    icon: MonitorDot,
    status: "active",
    detail: "Tracking 5 pages on clinicdirect.co.uk",
    href: "/integrations/clarity",
  },
];

export default function IntegrationsPage() {
  return (
    <>
      <PageHeader
        title="Integrations"
        description="Third-party service connections and data sync status."
      />
      <PageBody>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {INTEGRATIONS.map((int) => {
            const Icon = int.icon;
            return (
              <SectionCard key={int.name} className="hover:shadow-elevated transition-shadow">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <StatusPill tone="success">{int.status}</StatusPill>
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
            {[
              { service: "Shopify API", status: "Operational", latency: "42ms", uptime: "99.98%" },
              { service: "MongoDB Atlas", status: "Operational", latency: "8ms", uptime: "99.99%" },
              { service: "Microsoft Clarity", status: "Active", latency: "—", uptime: "100%" },
            ].map((s) => (
              <div key={s.service} className="flex items-center gap-4 px-5 py-4">
                <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                <div className="flex-1 font-medium text-sm">{s.service}</div>
                <StatusPill tone="success">{s.status}</StatusPill>
                <div className="text-xs text-muted-foreground hidden md:block">
                  {s.latency} avg
                </div>
                <div className="text-xs text-muted-foreground hidden md:block">
                  {s.uptime} uptime
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </PageBody>
    </>
  );
}
