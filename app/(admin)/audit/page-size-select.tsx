"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from "@/lib/audit-query";

export function PageSizeSelect({ pageSize }: { pageSize: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function change(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    // Changing the page size invalidates the current page number.
    params.delete("page");
    params.delete("offset");
    if (Number(value) === DEFAULT_PAGE_SIZE) params.delete("pageSize");
    else params.set("pageSize", value);
    const qs = params.toString();
    startTransition(() => router.push(qs ? `/audit?${qs}` : "/audit"));
  }

  return (
    <div className="flex items-center gap-1.5">
      <span id="audit-page-size">Rows per page</span>
      <Select value={String(pageSize)} onValueChange={change} disabled={pending}>
        <SelectTrigger className="h-8 w-20 text-xs" aria-labelledby="audit-page-size">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PAGE_SIZES.map((n) => (
            <SelectItem key={n} value={String(n)}>
              {n}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
