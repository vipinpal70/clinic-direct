"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RecalculateButton({ period }: { period: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    const res = await fetch("/api/commissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period }),
    });
    setLoading(false);
    if (res.ok) router.refresh();
  }

  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={loading}>
      <Settings2 className="h-4 w-4" />
      {loading ? "Recalculating…" : "Recalculate"}
    </Button>
  );
}
