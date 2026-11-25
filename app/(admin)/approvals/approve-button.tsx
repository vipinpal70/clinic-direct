"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/** Final admin approval: makes the clinic active and stamps its activation date. */
export function ApproveButton({
  clinicId,
  blocker,
}: {
  clinicId: string;
  /** Why approval isn't possible yet; null when it is. */
  blocker: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onApprove() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/clinics/${clinicId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    });
    setLoading(false);
    if (res.ok) return router.refresh();
    const body = await res.json().catch(() => ({}));
    setError(body.error ?? "Approval failed");
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        disabled={Boolean(blocker) || loading}
        onClick={onApprove}
        title={blocker ?? "Approve and activate this clinic"}
      >
        {loading ? "Approving…" : "Approve"}
      </Button>
      {(error || blocker) && (
        <p className={`max-w-[220px] text-right text-[11px] ${error ? "text-destructive" : "text-muted-foreground"}`}>
          {error ?? blocker}
        </p>
      )}
    </div>
  );
}
