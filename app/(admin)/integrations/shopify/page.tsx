import { CheckCircle2, RefreshCw, ExternalLink } from "lucide-react";
import { PageHeader, PageBody } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Shopify" };

const WEBHOOKS = [
  "orders/create",
  "orders/updated",
  "orders/paid",
  "orders/fulfilled",
  "customers/create",
  "customers/update",
  "products/update",
  "app/uninstalled",
];

const SYNC_LOGS = [
  { time: "2m ago", event: "orders/create", resource: "#102428", attempts: 1, result: "success" },
  { time: "6m ago", event: "orders/paid", resource: "#102427", attempts: 1, result: "success" },
  { time: "12m ago", event: "customers/create", resource: "cust_9821", attempts: 1, result: "success" },
  { time: "23m ago", event: "orders/create", resource: "#102422", attempts: 3, result: "failed" },
  { time: "41m ago", event: "orders/fulfilled", resource: "#102411", attempts: 1, result: "success" },
  { time: "1h ago", event: "products/update", resource: "MJ-5MG", attempts: 1, result: "success" },
];

export default function ShopifyPage() {
  return (
    <>
      <PageHeader
        title="Shopify"
        description="Storefront integration — webhooks, sync jobs and manual pulls."
        actions={
          <>
            <Button variant="outline" size="sm">
              <ExternalLink className="h-4 w-4" />
              Open store
            </Button>
            <Button size="sm">
              <RefreshCw className="h-4 w-4" />
              Manual sync
            </Button>
          </>
        }
      />
      <PageBody>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Connection"
            value="Connected"
            hint="clinicdirect.myshopify.com"
          />
          <StatCard label="Last sync" value="2m ago" hint="Every 5 minutes" />
          <StatCard label="Webhooks" value="8 / 8" hint="All healthy" />
          <StatCard label="Failed orders" value={2} hint="Auto-retrying" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SectionCard title="Store credentials">
            <div className="p-5 space-y-4 text-sm">
              <Field label="Store URL" value="clinicdirect.myshopify.com" />
              <Field label="Admin API key" value="shpat_••••••••••••4b2f" mono />
              <Field label="API version" value="2025-04" />
              <Field label="Webhook secret" value="••••••••••••••" mono />
              <div className="pt-2">
                <Button variant="outline" size="sm">
                  Rotate credentials
                </Button>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Webhook subscriptions">
            <ul className="divide-y divide-border">
              {WEBHOOKS.map((w) => (
                <li
                  key={w}
                  className="flex items-center justify-between px-5 py-3 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                    <span className="font-mono text-xs">{w}</span>
                  </div>
                  <StatusPill tone="success">active</StatusPill>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>

        <SectionCard title="Recent sync logs">
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
                {SYNC_LOGS.map((r, i) => (
                  <tr key={i} className="hover:bg-muted/40">
                    <td className="px-5 py-2.5 text-muted-foreground">{r.time}</td>
                    <td className="py-2.5 font-mono text-xs">{r.event}</td>
                    <td className="py-2.5 font-mono text-xs">{r.resource}</td>
                    <td className="py-2.5 tabular-nums">{r.attempts}</td>
                    <td className="py-2.5 pr-5">
                      <StatusPill
                        tone={r.result === "success" ? "success" : "destructive"}
                      >
                        {r.result}
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

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-muted-foreground">{label}</div>
      <div className={mono ? "font-mono text-xs" : ""}>{value}</div>
    </div>
  );
}
