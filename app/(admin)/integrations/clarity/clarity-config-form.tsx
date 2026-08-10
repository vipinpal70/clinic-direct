"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ClarityConfigForm({
  projectId,
  trackingDomain,
  active,
}: {
  projectId: string;
  trackingDomain: string;
  active: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState({ projectId, trackingDomain });
  const [enabled, setEnabled] = useState(active);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const res = await fetch("/api/integrations/clarity", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: enabled, config: form }),
    });

    setSaving(false);
    setMessage(res.ok ? "Saved." : "Failed to save.");
    if (res.ok) router.refresh();
  }

  return (
    <form onSubmit={onSave} className="p-5 space-y-4">
      <label className="block">
        <Label className="text-xs">Project ID</Label>
        <Input
          className="mt-1.5"
          value={form.projectId}
          onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}
        />
      </label>
      <label className="block">
        <Label className="text-xs">Tracking domain</Label>
        <Input
          className="mt-1.5"
          value={form.trackingDomain}
          onChange={(e) => setForm((f) => ({ ...f, trackingDomain: e.target.value }))}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        Tracking active
      </label>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </Button>
        {message && <span className="text-xs text-muted-foreground">{message}</span>}
      </div>
    </form>
  );
}
