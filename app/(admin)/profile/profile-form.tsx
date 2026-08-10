"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const [value, setValue] = useState(name);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: value }),
    });

    setSaving(false);
    setMessage(res.ok ? "Saved." : "Failed to save.");
    if (res.ok) router.refresh();
  }

  return (
    <form onSubmit={onSave} className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
      <label className="block">
        <div className="text-xs text-muted-foreground mb-1.5">Full name</div>
        <Input value={value} onChange={(e) => setValue(e.target.value)} />
      </label>
      <label className="block">
        <div className="text-xs text-muted-foreground mb-1.5">Email</div>
        <Input value={email} disabled />
      </label>
      <div className="sm:col-span-2 flex items-center gap-3">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
        {message && <span className="text-xs text-muted-foreground">{message}</span>}
      </div>
    </form>
  );
}
