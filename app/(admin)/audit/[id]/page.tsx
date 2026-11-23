import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { PageHeader, PageBody } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/session";
import { isAdminRole } from "@/lib/roles";
import { AUDIT_BASE, eventStatusTone, eventUrl, formatBytes, signatureLabel } from "../format";
import { CopyButton } from "./copy-button";

export const metadata = { title: "Audit · Request" };
export const dynamic = "force-dynamic";

const OBJECT_ID = /^[a-f0-9]{24}$/i;

function fmt(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}

export default async function WebhookEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Middleware already blocks non-admins; re-check so the page is safe on its own.
  const session = await getSessionFromCookies();
  if (!isAdminRole(session?.user.role)) redirect("/");

  const { id } = await params;
  if (!OBJECT_ID.test(id)) notFound();

  const event = await prisma.webhookEvent.findUnique({ where: { id } });
  if (!event) notFound();

  const body =
    event.payload !== null && event.payload !== undefined
      ? JSON.stringify(event.payload, null, 2)
      : (event.rawBody ?? "");
  const headers = JSON.stringify(event.headers ?? {}, null, 2);
  const response =
    event.response !== null && event.response !== undefined
      ? JSON.stringify(event.response, null, 2)
      : null;

  const meta: [string, string, boolean?][] = [
    ["Received", fmt(event.receivedAt)],
    ["Triggered (Shopify)", fmt(event.triggeredAt)],
    ["Status", event.httpStatus !== null ? `HTTP ${event.httpStatus}` : "—"],
    ["Endpoint", event.endpoint, true],
    ["Topic", event.topic ?? "—", true],
    ["Shop domain", event.shopDomain ?? "—", true],
    ["API version", event.apiVersion ?? "—", true],
    ["Webhook ID", event.webhookId ?? "—", true],
    ["Event ID", event.eventId ?? "—", true],
    ["Resource ID", event.resourceId ?? "—", true],
    ["Records", event.recordCount !== null ? String(event.recordCount) : "—"],
    ["Body size", formatBytes(event.bodyBytes)],
    ["Signature", signatureLabel(event.signatureValid)],
    ["Handled in", event.durationMs !== null ? `${event.durationMs} ms` : "—"],
  ];

  return (
    <>
      <PageHeader
        title={event.topic ?? event.endpoint}
        description={`${event.method ?? "POST"} ${eventUrl(event)}`}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href={AUDIT_BASE}>
                <ArrowLeft className="h-4 w-4" />
                Audit
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download, not a page navigation */}
              <a href={`/api/audit/webhook-events/${event.id}`}>
                <Download className="h-4 w-4" />
                Download JSON
              </a>
            </Button>
          </>
        }
      />
      <PageBody>
        <SectionCard
          title="Delivery"
          actions={<StatusPill tone={eventStatusTone(event.status)}>{event.status}</StatusPill>}
        >
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 p-5 text-sm">
            {meta.map(([label, value, mono]) => (
              <div key={label} className="min-w-0">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className={mono ? "font-mono text-xs mt-0.5 break-all" : "mt-0.5"}>{value}</dd>
              </div>
            ))}
          </dl>
          {event.error && (
            <div className="mx-5 mb-5 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive break-words">
              {event.error}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title={event.payload !== null && event.payload !== undefined ? "Payload" : "Raw body"}
          description={
            event.payload !== null && event.payload !== undefined
              ? "Parsed JSON body, exactly as received."
              : "The body was not valid JSON or was too large to store parsed, so it was kept as text (first 100 KB)."
          }
          actions={<CopyButton text={body} label="Copy payload" />}
        >
          <JsonBlock text={body || "(empty body)"} />
        </SectionCard>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SectionCard
            title="Headers"
            description="Shopify headers plus a few transport headers. Secrets are shown as [redacted]."
          >
            <JsonBlock text={headers} />
          </SectionCard>
          <SectionCard
            title="Response"
            description={`The JSON body we sent back${event.httpStatus !== null ? ` with HTTP ${event.httpStatus}` : ""}.`}
          >
            <JsonBlock text={response ?? "(no JSON reply recorded)"} />
          </SectionCard>
        </div>
      </PageBody>
    </>
  );
}

function JsonBlock({ text }: { text: string }) {
  return (
    <pre className="max-h-[70vh] overflow-auto bg-muted/50 px-5 py-4 font-mono text-xs leading-relaxed whitespace-pre">
      {text}
    </pre>
  );
}
