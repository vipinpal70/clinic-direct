"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileDown, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PeriodOption {
  period: string;
  count: number;
}

export function GenerateInvoicesButton({ periods }: { periods: PeriodOption[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [period, setPeriod] = useState(periods[0]?.period ?? "");

  const nothingToDo = periods.length === 0;

  async function onClick() {
    if (!period) return;
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period }),
    });
    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setMessage(body?.error ?? "Nothing to generate");
      return;
    }
    router.refresh();
  }

  if (nothingToDo) {
    return (
      <Button variant="outline" size="sm" disabled>
        <FileDown className="h-4 w-4" />
        No commissions to invoice
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          disabled={loading}
          className="h-9 rounded-md border border-input bg-card px-2 text-sm"
          aria-label="Commission period to invoice"
        >
          {periods.map((p) => (
            <option key={p.period} value={p.period}>
              {p.period} ({p.count})
            </option>
          ))}
        </select>
        <Button variant="outline" size="sm" onClick={onClick} disabled={loading}>
          <FileDown className="h-4 w-4" />
          {loading ? "Generating…" : "Generate invoices"}
        </Button>
      </div>
      {message && <span className="text-xs text-muted-foreground">{message}</span>}
    </div>
  );
}

export function PushQueuedButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    const res = await fetch("/api/invoices/push", { method: "POST" });
    setLoading(false);
    if (res.ok) router.refresh();
  }

  return (
    <Button size="sm" onClick={onClick} disabled={loading || disabled}>
      <Send className="h-4 w-4" />
      {loading ? "Pushing…" : "Push queued"}
    </Button>
  );
}
