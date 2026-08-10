"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ManualSyncButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onClick() {
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/integrations/shopify/sync", { method: "POST" });
    const body = await res.json().catch(() => null);
    setLoading(false);

    if (!res.ok) {
      setMessage(body?.error ?? "Sync failed");
      return;
    }
    setMessage(`Synced ${body.data.synced} orders.`);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" onClick={onClick} disabled={loading}>
        <RefreshCw className="h-4 w-4" />
        {loading ? "Syncing…" : "Manual sync"}
      </Button>
      {message && <span className="text-xs text-muted-foreground">{message}</span>}
    </div>
  );
}
