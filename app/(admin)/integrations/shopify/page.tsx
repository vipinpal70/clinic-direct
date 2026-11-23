import Link from "next/link";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { PageHeader, PageBody } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { relativeTime } from "@/lib/utils";
import { getTokenStatus, shopifyConfigured, type TokenStatus } from "@/lib/shopify";
import { getSessionFromCookies } from "@/lib/session";
import { isAdminRole } from "@/lib/roles";
import { ApiPullButton } from "./shopify-actions";

export const metadata = { title: "Shopify" };
export const dynamic = "force-dynamic";

const WEBHOOK_TOPICS = [
  "orders/create",
  "orders/updated",
  "orders/paid",
  "orders/fulfilled",
];

function mask(value: string | undefined) {
  if (!value) return null;
  return value.length > 4 ? `••••••••${value.slice(-4)}` : "••••••••";
}

export default async function ShopifyPage() {
  const [config, recentLogs, failedCount, tokenStatus, session] = await Promise.all([
    prisma.integrationConfig.findUnique({ where: { provider: "shopify" } }),
    prisma.webhookLog.findMany({
      where: { provider: "shopify" },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.webhookLog.count({ where: { provider: "shopify", status: "failed" } }),
    getTokenStatus(),
    getSessionFromCookies(),
  ]);
  const canViewAudit = isAdminRole(session?.user.role);

  const storeUrl = process.env.SHOPIFY_STORE_URL;
  const clientId = mask(process.env.SHOPIFY_CLIENT_ID);
  const clientSecret = mask(process.env.SHOPIFY_CLIENT_SECRET);
  const apiKey = mask(process.env.SHOPIFY_ADMIN_API_KEY);
  const apiVersion = process.env.SHOPIFY_API_VERSION || "2025-01";
  const webhookSecret = mask(process.env.SHOPIFY_WEBHOOK_SECRET);
  const configured = shopifyConfigured();

  return (
    <>
      <PageHeader
        title="Shopify"
        description="Storefront integration — webhooks, sync jobs and manual pulls."
        actions={
          <>
            {storeUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={`https://${storeUrl}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Open store
                </a>
              </Button>
            )}
            <ApiPullButton />
          </>
        }
      />
      <PageBody>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Connection"
            value={configured ? "Configured" : "Not configured"}
            hint={storeUrl ?? "Set SHOPIFY_STORE_URL"}
          />
          <StatCard
            label="Access token"
            value={tokenLabel(tokenStatus)}
            hint={tokenHint(tokenStatus)}
          />
          <StatCard
            label="Last pull"
            value={config?.lastSyncAt ? relativeTime(config.lastSyncAt) : "Never"}
          />
          <StatCard label="Failed events" value={failedCount} hint="All time" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SectionCard title="Store credentials">
            <div className="p-5 space-y-4 text-sm">
              <Field label="Store URL" value={storeUrl ?? "Not set"} />
              <Field label="API version" value={apiVersion} mono />
              <Field label="Client ID" value={clientId ?? "Not set"} mono />
              <Field label="Client secret" value={clientSecret ?? "Not set"} mono />
              <Field label="Admin API key (fallback)" value={apiKey ?? "Not set"} mono />
              <Field label="Webhook secret" value={webhookSecret ?? "Not set"} mono />
              <p className="text-xs text-muted-foreground pt-1">
                Set via environment variables (SHOPIFY_STORE_URL,
                SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET, SHOPIFY_API_VERSION,
                SHOPIFY_WEBHOOK_SECRET). The access token is minted from the
                client credentials on demand and cached until it expires;
                SHOPIFY_ADMIN_API_KEY is used only when no client credentials are
                set.
              </p>
            </div>
          </SectionCard>

          <SectionCard title="Webhook endpoint">
            <div className="p-5 space-y-3">
              <p className="text-xs text-muted-foreground">
                Point these Shopify webhook topics at:
              </p>
              <code className="block rounded-md bg-muted px-3 py-2 text-xs font-mono break-all">
                /api/webhooks/shopify
              </code>
              <ul className="divide-y divide-border mt-2">
                {WEBHOOK_TOPICS.map((w) => (
                  <li key={w} className="flex items-center justify-between py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                      <span className="font-mono text-xs">{w}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </SectionCard>
        </div>

        <SectionCard
          title="Recent sync logs"
          actions={
            canViewAudit ? (
              <Button variant="outline" size="sm" asChild>
                <Link href="/audit">View webhook audit</Link>
              </Button>
            ) : undefined
          }
        >
          {recentLogs.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No webhook activity recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="font-medium px-5 py-2.5">Time</th>
                    <th className="font-medium py-2.5">Event</th>
                    <th className="font-medium py-2.5">Resource</th>
                    <th className="font-medium py-2.5">Attempts</th>
                    <th className="font-medium py-2.5 pr-5">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentLogs.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/40">
                      <td className="px-5 py-2.5 text-muted-foreground">{relativeTime(r.createdAt)}</td>
                      <td className="py-2.5 font-mono text-xs">{r.event}</td>
                      <td className="py-2.5 font-mono text-xs">{r.resourceId}</td>
                      <td className="py-2.5 tabular-nums">{r.attempts}</td>
                      <td className="py-2.5 pr-5">
                        <StatusPill tone={r.status === "success" ? "success" : "destructive"}>
                          {r.status}
                        </StatusPill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </PageBody>
    </>
  );
}

function tokenLabel(s: TokenStatus): string {
  if (s.state === "none") return "Not fetched";
  if (s.state === "static") return "Static key";
  return s.state === "valid" ? "Valid" : "Expired";
}

function tokenHint(s: TokenStatus): string {
  if (s.state === "none") return "Minted on first pull";
  if (s.state === "static") return "SHOPIFY_ADMIN_API_KEY";
  const hours = Math.round(
    (new Date(s.expiresAt).getTime() - Date.now()) / 3_600_000,
  );
  return s.state === "valid"
    ? `~${Math.max(0, hours)}h left`
    : "Regenerates on next pull";
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-muted-foreground">{label}</div>
      <div className={mono ? "font-mono text-xs" : ""}>{value}</div>
    </div>
  );
}
