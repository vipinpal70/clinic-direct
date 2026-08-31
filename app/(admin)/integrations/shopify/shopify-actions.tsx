"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Resource = "all" | "customers" | "orders";

export function ApiPullButton() {
  const router = useRouter();
  const [loading, setLoading] = useState<Resource | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);

  async function pull(resource: Resource) {
    setLoading(resource);
    setMessage(null);
    setError(false);
    try {
      const res = await fetch("/api/integrations/shopify/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource }),
      });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        setError(true);
        setMessage(body?.error ?? "Pull failed");
        return;
      }

      const c = body?.data?.customers;
      const o = body?.data?.orders;
      const parts: string[] = [];
      if (c) {
        parts.push(
          `${c.total} customers → ${c.clinicsCount} clinics` +
            (c.errors?.length ? ` (${c.errors.length} errors)` : ""),
        );
      }
      if (o) {
        parts.push(
          `${o.processed} orders → ${o.withClinic} linked` +
            (o.errors?.length ? ` (${o.errors.length} errors)` : ""),
        );
      }
      setMessage(`Pulled ${parts.join(" · ") || "nothing"}.`);
      router.refresh();
    } catch {
      setError(true);
      setMessage("Pull failed — network error");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => pull("all")} disabled={loading !== null}>
          <RefreshCw
            className={`h-4 w-4 ${loading === "all" ? "animate-spin" : ""}`}
          />
          {loading === "all" ? "Pulling…" : "Pull from API"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => pull("customers")}
          disabled={loading !== null}
        >
          {loading === "customers" ? "Pulling…" : "Clinics"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => pull("orders")}
          disabled={loading !== null}
        >
          {loading === "orders" ? "Pulling…" : "Orders"}
        </Button>
      </div>
      {message && (
        <span
          className={`text-xs max-w-sm text-right ${
            error ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          {message}
        </span>
      )}
    </div>
  );
}
