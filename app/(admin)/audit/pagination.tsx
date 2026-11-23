import Link from "next/link";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PageInfo } from "@/lib/audit-query";
import { AUDIT_BASE, auditHref } from "./format";
import { PageSizeSelect } from "./page-size-select";

/** Page numbers to render: always first + last, a window around the current page, gaps as null. */
function pageWindow(page: number, totalPages: number, radius = 1): (number | null)[] {
  const pages = new Set<number>([1, totalPages]);
  for (let p = page - radius; p <= page + radius; p++) {
    if (p >= 1 && p <= totalPages) pages.add(p);
  }
  // Show 1 2 3 instead of 1 … 3 when the gap is a single page.
  if (page - radius === 3) pages.add(2);
  if (page + radius === totalPages - 2) pages.add(totalPages - 1);

  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(null);
    out.push(p);
  });
  return out;
}

const itemBase =
  "inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-xs tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function PageLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className={cn(itemBase, "text-muted-foreground/50 cursor-not-allowed")} aria-disabled="true" aria-label={label}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={cn(itemBase, "border border-input hover:bg-accent")} aria-label={label}>
      {children}
    </Link>
  );
}

export function Pagination({
  info,
  params,
}: {
  info: PageInfo;
  /** Current filter params, without page/offset. */
  params: Record<string, string | undefined>;
}) {
  const href = (page: number) => auditHref(params, { page: page === 1 ? null : String(page), offset: null });
  const hidden = Object.entries(params).filter(([, v]) => v) as [string, string][];

  return (
    <div className="flex flex-col gap-3 px-5 py-3 border-t border-border text-xs text-muted-foreground lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span>
          {info.total === 0 ? (
            "No rows"
          ) : (
            <>
              Showing <span className="font-medium text-foreground tabular-nums">{info.from.toLocaleString("en-GB")}</span>
              –<span className="font-medium text-foreground tabular-nums">{info.to.toLocaleString("en-GB")}</span> of{" "}
              <span className="font-medium text-foreground tabular-nums">{info.total.toLocaleString("en-GB")}</span>
              <span className="ml-2 font-mono text-[11px]">(offset {info.offset})</span>
            </>
          )}
        </span>
        <PageSizeSelect pageSize={info.pageSize} />
      </div>

      {info.totalPages > 1 && (
        <div className="flex flex-wrap items-center gap-3">
          <nav aria-label="Pagination" className="flex items-center gap-1">
            <PageLink href={href(1)} disabled={!info.hasPrev} label="First page">
              <ChevronsLeft className="h-4 w-4" />
            </PageLink>
            <PageLink href={href(info.page - 1)} disabled={!info.hasPrev} label="Previous page">
              <ChevronLeft className="h-4 w-4" />
            </PageLink>
            {pageWindow(info.page, info.totalPages).map((p, i) =>
              p === null ? (
                <span key={`gap-${i}`} className="px-1" aria-hidden>
                  …
                </span>
              ) : p === info.page ? (
                <span
                  key={p}
                  aria-current="page"
                  className={cn(itemBase, "bg-primary text-primary-foreground font-medium")}
                >
                  {p}
                </span>
              ) : (
                <Link key={p} href={href(p)} className={cn(itemBase, "hover:bg-accent text-foreground")} aria-label={`Page ${p}`}>
                  {p}
                </Link>
              ),
            )}
            <PageLink href={href(info.page + 1)} disabled={!info.hasNext} label="Next page">
              <ChevronRight className="h-4 w-4" />
            </PageLink>
            <PageLink href={href(info.totalPages)} disabled={!info.hasNext} label="Last page">
              <ChevronsRight className="h-4 w-4" />
            </PageLink>
          </nav>

          {/* Plain GET form: works without JS and keeps every current filter. */}
          <form action={AUDIT_BASE} method="get" className="flex items-center gap-1.5">
            {hidden.map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
            <label htmlFor="audit-goto" className="whitespace-nowrap">
              Go to page
            </label>
            <input
              id="audit-goto"
              name="page"
              type="number"
              min={1}
              max={info.totalPages}
              defaultValue={info.page}
              className="h-8 w-16 rounded-md border border-input bg-background px-2 text-xs tabular-nums text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
            <button
              type="submit"
              className={cn(itemBase, "border border-input text-foreground hover:bg-accent")}
            >
              Go
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
