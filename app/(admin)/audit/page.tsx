import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Inbox } from "lucide-react";
import { PageHeader, PageBody } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { StatusPill } from "@/components/shared/status-pill";
import { prisma } from "@/lib/prisma";
import {
  activeFilterCount,
  auditParams,
  buildAuditWhere,
  paginate,
  parseAuditQuery,
  sourceWhere,
  type AuditQuery,
} from "@/lib/audit-query";
import { getSessionFromCookies } from "@/lib/session";
import { isAdminRole } from "@/lib/roles";
import { cn, relativeTime } from "@/lib/utils";
import { buildFieldInventory } from "@/lib/webhook-fields";
import { EventFilters } from "./event-filters";
import { Pagination } from "./pagination";
import {
  AUDIT_BASE,
  auditHref,
  eventStatusTone,
  eventUrl,
  formatBytes,
  jsonExcerpt,
  responsePreview,
} from "./format";

export const metadata = { title: "Audit" };
export const dynamic = "force-dynamic";

/** Payloads sampled for the field inventory — newest first. */
const FIELD_SAMPLE_SIZE = 200;
/** Response shown inline when a row is expanded; the event page shows all of it. */
const INLINE_RESPONSE_CHARS = 4_000;

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AuditPage({ searchParams }: Props) {
  // Middleware already blocks non-admins; re-check here so the page is safe on its own.
  const session = await getSessionFromCookies();
  if (!isAdminRole(session?.user.role)) redirect("/");

  const sp = await searchParams;
  const view = sp.view === "fields" ? "fields" : "events";
  const query = parseAuditQuery(sp);

  const [groups, httpGroups, total, processed, problems, latest] = await Promise.all([
    prisma.webhookEvent.groupBy({
      by: ["endpoint", "topic"],
      _count: { _all: true },
      _max: { receivedAt: true },
    }),
    prisma.webhookEvent.groupBy({ by: ["httpStatus"], _count: { _all: true } }),
    prisma.webhookEvent.count(),
    prisma.webhookEvent.count({ where: { status: "processed" } }),
    prisma.webhookEvent.count({
      where: { status: { in: ["failed", "rejected", "error"] } },
    }),
    prisma.webhookEvent.findFirst({
      orderBy: { receivedAt: "desc" },
      select: { receivedAt: true },
    }),
  ]);

  const sources = groups
    .map((g) => ({
      endpoint: g.endpoint,
      topic: g.topic,
      count: g._count._all,
      last: g._max.receivedAt,
    }))
    .sort((a, b) => (b.last?.getTime() ?? 0) - (a.last?.getTime() ?? 0));

  const topics = [...new Set(sources.map((s) => s.topic ?? "none"))].sort();
  const httpCodes = httpGroups
    .map((g) => g.httpStatus)
    .filter((c): c is number => typeof c === "number")
    .sort((a, b) => a - b);
  const filterParams = auditParams(query);
  const fieldsSp = {
    endpoint: typeof sp.endpoint === "string" ? sp.endpoint : undefined,
    topic: typeof sp.topic === "string" ? sp.topic : undefined,
  };

  return (
    <>
      <PageHeader
        title="Audit"
        description="Every request received on the inbound webhook APIs: the URL that was called, the status we returned and the response we sent. Rejected requests are included."
      />
      <PageBody>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Requests received" value={total} hint="All time" icon={<Inbox className="h-4 w-4" />} />
          <StatCard label="Processed" value={processed} hint="Accepted and handled" />
          <StatCard label="Failed or rejected" value={problems} hint="Needs a look" />
          <StatCard
            label="Last received"
            value={latest ? relativeTime(latest.receivedAt) : "Never"}
          />
        </div>

        <nav className="flex gap-1 border-b border-border" aria-label="View">
          {(
            [
              ["events", "Requests"],
              ["fields", "Fields seen"],
            ] as const
          ).map(([key, label]) => (
            <Link
              key={key}
              href={auditHref(filterParams, { view: key === "events" ? null : key })}
              aria-current={view === key ? "page" : undefined}
              className={cn(
                "px-3 py-2 text-sm -mb-px border-b-2 transition-colors",
                view === key
                  ? "border-primary text-foreground font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>

        {view === "events" ? (
          <EventsView query={query} params={filterParams} topics={topics} httpCodes={httpCodes} />
        ) : (
          <FieldsView sp={fieldsSp} sources={sources} />
        )}
      </PageBody>
    </>
  );
}

async function EventsView({
  query,
  params,
  topics,
  httpCodes,
}: {
  query: AuditQuery;
  params: Record<string, string | undefined>;
  topics: string[];
  httpCodes: number[];
}) {
  const where = buildAuditWhere(query.filters);
  // Count first so an out-of-range ?page= is clamped to the last page.
  const matching = await prisma.webhookEvent.count({ where });
  const info = paginate(matching, query.page, query.pageSize);
  const filtered = activeFilterCount(query.filters) > 0;

  const events = await prisma.webhookEvent.findMany({
      where,
      orderBy: { receivedAt: query.filters.sort },
      skip: info.offset,
      take: info.pageSize,
      select: {
        id: true,
        endpoint: true,
        method: true,
        url: true,
        topic: true,
        resourceId: true,
        status: true,
        httpStatus: true,
        response: true,
        bodyBytes: true,
        error: true,
        receivedAt: true,
      },
    });

  return (
    <SectionCard
      title="Requests"
      description={`${matching.toLocaleString("en-GB")} ${filtered ? "matching" : "in total"}`}
    >
      <Suspense fallback={null}>
        <EventFilters topics={topics} httpCodes={httpCodes} />
      </Suspense>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b border-border">
              <th className="font-medium px-5 py-2.5 w-28">Received</th>
              <th className="font-medium py-2.5">API URL</th>
              <th className="font-medium py-2.5 pl-4 w-36">Status</th>
              <th className="font-medium py-2.5 pl-4 pr-5">Response</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {events.length === 0 && (
              <tr>
                <td colSpan={4} className="py-12 text-center text-sm text-muted-foreground">
                  {matching === 0 && !filtered
                    ? "No webhook requests received yet. They will appear here as soon as one arrives."
                    : "No requests match these filters."}
                </td>
              </tr>
            )}
            {events.map((e) => {
              const preview = responsePreview(e.response);
              return (
                <tr key={e.id} className="align-top hover:bg-muted/40 transition-colors">
                  <td className="px-5 py-3 whitespace-nowrap">
                    <Link
                      href={`${AUDIT_BASE}/${e.id}`}
                      className="text-foreground hover:underline underline-offset-4"
                      title={`${e.receivedAt.toISOString()}, open full request`}
                    >
                      {relativeTime(e.receivedAt)}
                    </Link>
                  </td>
                  <td className="py-3 min-w-[280px]">
                    <div className="flex items-start gap-2">
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold">
                        {e.method ?? "POST"}
                      </span>
                      <span className="font-mono text-xs break-all">{eventUrl(e)}</span>
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground font-mono">
                      {[e.topic ?? "no topic header", e.resourceId && `id ${e.resourceId}`, formatBytes(e.bodyBytes)]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </td>
                  <td className="py-3 pl-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "font-mono text-xs font-semibold tabular-nums",
                          e.httpStatus !== null && e.httpStatus >= 400 && "text-destructive",
                        )}
                      >
                        {e.httpStatus ?? "—"}
                      </span>
                      <StatusPill tone={eventStatusTone(e.status)}>{e.status}</StatusPill>
                    </div>
                    {e.error && (
                      <div
                        className="mt-1 max-w-[220px] truncate text-[11px] text-muted-foreground"
                        title={e.error}
                      >
                        {e.error}
                      </div>
                    )}
                  </td>
                  <td className="py-3 pl-4 pr-5 max-w-[420px]">
                    {preview ? (
                      <details className="group">
                        <summary className="cursor-pointer list-none font-mono text-xs text-muted-foreground truncate hover:text-foreground [&::-webkit-details-marker]:hidden">
                          <span className="inline-block mr-1 transition-transform group-open:rotate-90" aria-hidden>
                            ▸
                          </span>
                          {preview}
                        </summary>
                        <pre className="mt-2 max-h-80 overflow-auto rounded-md bg-muted/50 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-all">
                          {jsonExcerpt(e.response, INLINE_RESPONSE_CHARS)}
                        </pre>
                        <Link
                          href={`${AUDIT_BASE}/${e.id}`}
                          className="mt-1 inline-block text-[11px] text-primary hover:underline underline-offset-4"
                        >
                          Open full request and response
                        </Link>
                      </details>
                    ) : (
                      <span className="text-xs text-muted-foreground">No response recorded</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Suspense fallback={null}>
        <Pagination info={info} params={params} />
      </Suspense>
    </SectionCard>
  );
}

interface Source {
  endpoint: string;
  topic: string | null;
  count: number;
  last: Date | null;
}

async function FieldsView({
  sp,
  sources,
}: {
  sp: { endpoint?: string; topic?: string };
  sources: Source[];
}) {
  if (sources.length === 0) {
    return (
      <SectionCard title="Fields seen">
        <div className="py-12 text-center text-sm text-muted-foreground">
          No webhook requests received yet. Once Shopify sends one, its fields will be listed here.
        </div>
      </SectionCard>
    );
  }

  // Payload shapes differ per endpoint/topic, so the inventory is always scoped
  // to one source. Default to the most recently active one.
  const selected =
    sources.find((s) => s.endpoint === sp.endpoint && (s.topic ?? "none") === sp.topic) ??
    sources.find((s) => s.endpoint === sp.endpoint) ??
    sources[0];
  const endpoint = selected.endpoint;
  const topic = selected.topic ?? "none";

  const rows = await prisma.webhookEvent.findMany({
    where: sourceWhere(endpoint, topic),
    orderBy: { receivedAt: "desc" },
    take: FIELD_SAMPLE_SIZE,
    select: { payload: true },
  });
  const payloads = rows.map((r) => r.payload).filter((p) => p !== null && p !== undefined);
  const fields = buildFieldInventory(payloads);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-4 items-start">
      <SectionCard title="Sources">
        <ul className="divide-y divide-border">
          {sources.map((s) => {
            const key = s.topic ?? "none";
            const active = s.endpoint === endpoint && key === topic;
            return (
              <li key={`${s.endpoint}|${key}`}>
                <Link
                  href={auditHref({ view: "fields", endpoint: s.endpoint, topic: key })}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "block px-5 py-2.5 text-sm transition-colors",
                    active ? "bg-muted font-medium" : "hover:bg-muted/40",
                  )}
                >
                  <div className="font-mono text-xs">{s.topic ?? "(no topic header)"}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {s.endpoint} · {s.count} request{s.count === 1 ? "" : "s"}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </SectionCard>

      <SectionCard
        title={`Fields in ${topic === "none" ? endpoint : topic}`}
        description={`${fields.length} paths across the latest ${payloads.length} payload${payloads.length === 1 ? "" : "s"}. "Seen in" below 100% means the field is optional; "null" in types means it can be empty.`}
      >
        {fields.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No parseable JSON payloads for this source. Open a request to see its raw body.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="font-medium px-5 py-2.5">Path</th>
                  <th className="font-medium py-2.5">Types</th>
                  <th className="font-medium py-2.5 text-right">Seen in</th>
                  <th className="font-medium py-2.5 pl-4 pr-5">Sample</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {fields.map((f) => {
                  const pct = Math.round((f.events / payloads.length) * 100);
                  return (
                    <tr key={f.path} className="hover:bg-muted/40">
                      <td className="px-5 py-2 font-mono text-xs break-all">{f.path}</td>
                      <td className="py-2 text-xs whitespace-nowrap">{f.types.join(" | ")}</td>
                      <td
                        className={cn(
                          "py-2 text-xs tabular-nums text-right whitespace-nowrap",
                          pct < 100 && "text-muted-foreground",
                        )}
                      >
                        {pct}%
                      </td>
                      <td className="py-2 pl-4 pr-5 font-mono text-[11px] text-muted-foreground break-all">
                        {f.sample ?? ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
