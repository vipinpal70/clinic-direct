"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUSES = ["pending", "processing", "fulfilled", "refunded", "cancelled"];

export function OrderFilters({
  clinics,
}: {
  clinics: { id: string; name: string; code: string }[];
}) {
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
    startTransition(() => router.push(`/orders?${params.toString()}`));
  }

  return (
    <div className="flex items-center gap-2 px-5 py-3 border-b border-border flex-wrap">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          placeholder="Search orders, customers…"
          className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            pushParams({ search: e.target.value || null });
          }}
        />
      </div>

      <Select
        value={searchParams.get("status") ?? "all"}
        onValueChange={(v) => pushParams({ status: v === "all" ? null : v })}
      >
        <SelectTrigger className="h-8 w-36 text-xs">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {STATUSES.map((s) => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get("clinicId") ?? "all"}
        onValueChange={(v) => pushParams({ clinicId: v === "all" ? null : v })}
      >
        <SelectTrigger className="h-8 w-44 text-xs">
          <SelectValue placeholder="Clinic" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All clinics</SelectItem>
          {clinics.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.code} · {c.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
