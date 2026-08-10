"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

const STATUSES = ["active", "pending", "suspended", "inactive"] as const;

export function ClinicFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [, startTransition] = useTransition();

  function pushParams(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    startTransition(() => {
      router.push(`/clinics?${params.toString()}`);
    });
  }

  const activeStatus = searchParams.get("status");

  return (
    <div className="flex items-center gap-2 px-5 py-3 border-b border-border flex-wrap">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          placeholder="Search clinics…"
          className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            pushParams({ search: e.target.value || null });
          }}
        />
      </div>
      {STATUSES.map((s) => (
        <Button
          key={s}
          variant={activeStatus === s ? "default" : "outline"}
          size="sm"
          onClick={() => pushParams({ status: activeStatus === s ? null : s })}
        >
          {s}
        </Button>
      ))}
    </div>
  );
}
