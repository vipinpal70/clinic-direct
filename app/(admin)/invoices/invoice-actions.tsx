"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileDown, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

export function GenerateInvoicesButton({ period }: { period: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onClick() {
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

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" size="sm" onClick={onClick} disabled={loading}>
        <FileDown className="h-4 w-4" />
        {loading ? "Generating…" : "Generate invoices"}
      </Button>
      {message && <span className="text-xs text-muted-foreground">{message}</span>}
    </div>
  );
}

export function PushQueuedButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    const res = await fetch("/api/invoices/push", { method: "POST" });
    setLoading(false);
    if (res.ok) router.refresh();
  }

  return (
    <Button size="sm" onClick={onClick} disabled={loading}>
      <Send className="h-4 w-4" />
      {loading ? "Pushing…" : "Push queued"}
    </Button>
  );
}
