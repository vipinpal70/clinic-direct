"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EVENT_STATUSES, HTTP_METHODS } from "@/lib/audit-query";
import { WEBHOOK_ENDPOINTS } from "@/lib/webhook-constants";

/** Keys that narrow results; page size and sort survive "Clear filters". */
const FILTER_KEYS = ["q", "method", "endpoint", "topic", "status", "http", "signature", "from", "to"];

interface Props {
  topics: string[];
  httpCodes: number[];
}

export function EventFilters({ topics, httpCodes }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const firstRender = useRef(true);

  function pushParams(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    // Any filter change starts again from the first page.
    params.delete("page");
    params.delete("offset");
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const qs = params.toString();
    startTransition(() => router.push(qs ? `/audit?${qs}` : "/audit"));
  }

  // Debounce the free-text search so each keystroke doesn't trigger a query.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (search.trim() === (searchParams.get("q") ?? "")) return;
    const t = setTimeout(() => pushParams({ q: search.trim() || null }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the typed text should re-arm the timer
  }, [search]);

  const active = FILTER_KEYS.filter((k) => searchParams.get(k)).length;

  const select = (
    key: string,
    label: string,
    width: string,
    options: { value: string; label: string }[],
  ) => (
    <Select
      value={searchParams.get(key) ?? "all"}
      onValueChange={(v) => pushParams({ [key]: v === "all" ? null : v })}
    >
      <SelectTrigger
        className={cn("h-8 text-xs", width, searchParams.get(key) && "border-primary/60")}
        aria-label={label}
      >
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All {label.toLowerCase()}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const httpOptions = [
    { value: "2xx", label: "2xx success" },
    { value: "4xx", label: "4xx client error" },
    { value: "5xx", label: "5xx server error" },
    ...httpCodes.map((c) => ({ value: String(c), label: String(c) })),
    { value: "none", label: "No reply recorded" },
  ];

  const dateInput =
    "h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40";

  return (
    <div
      className={cn("space-y-2 px-5 py-3 border-b border-border transition-opacity", pending && "opacity-70")}
      aria-busy={pending}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            placeholder="Search URL, topic, resource / webhook id, error…"
            aria-label="Search requests"
            className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <label htmlFor="audit-from">From</label>
          <input
            id="audit-from"
            type="date"
            className={dateInput}
            value={searchParams.get("from") ?? ""}
            max={searchParams.get("to") ?? undefined}
            onChange={(e) => pushParams({ from: e.target.value || null })}
          />
          <label htmlFor="audit-to">to</label>
          <input
            id="audit-to"
            type="date"
            className={dateInput}
            value={searchParams.get("to") ?? ""}
            min={searchParams.get("from") ?? undefined}
            onChange={(e) => pushParams({ to: e.target.value || null })}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {select("method", "Methods", "w-32", HTTP_METHODS.map((m) => ({ value: m, label: m })))}
        {select("endpoint", "Endpoints", "w-40", WEBHOOK_ENDPOINTS.map((e) => ({ value: e, label: e })))}
        {select(
          "topic",
          "Topics",
          "w-44",
          topics.map((t) => ({ value: t, label: t === "none" ? "(no topic header)" : t })),
        )}
        {select("http", "HTTP statuses", "w-40", httpOptions)}
        {select("status", "Results", "w-32", EVENT_STATUSES.map((s) => ({ value: s, label: s })))}
        {select("signature", "Signatures", "w-36", [
          { value: "valid", label: "Valid" },
          { value: "invalid", label: "Invalid" },
          { value: "unchecked", label: "Not checked" },
        ])}

        <Select
          value={searchParams.get("sort") === "asc" ? "asc" : "desc"}
          onValueChange={(v) => pushParams({ sort: v === "asc" ? "asc" : null })}
        >
          <SelectTrigger className="h-8 w-32 text-xs" aria-label="Sort order">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">Newest first</SelectItem>
            <SelectItem value="asc">Oldest first</SelectItem>
          </SelectContent>
        </Select>

        {active > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              pushParams(Object.fromEntries(FILTER_KEYS.map((k) => [k, null])));
            }}
          >
            <X className="h-4 w-4" />
            Clear {active} filter{active === 1 ? "" : "s"}
          </Button>
        )}
      </div>
    </div>
  );
}
