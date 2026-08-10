"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ApproveButton({
  clinicId,
  disabled,
}: {
  clinicId: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onApprove() {
    setLoading(true);
    const res = await fetch(`/api/clinics/${clinicId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    });
    setLoading(false);
    if (res.ok) router.refresh();
  }

  return (
    <Button size="sm" disabled={disabled || loading} onClick={onApprove}>
      {loading ? "Approving…" : "Approve"}
    </Button>
  );
}
