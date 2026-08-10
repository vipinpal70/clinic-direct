"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function CredentialsForm({
  clinicId,
  loginEmail,
}: {
  clinicId: string;
  loginEmail: string | null;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(loginEmail ?? "");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSave() {
    setSaving(true);
    setMessage(null);

    const res = await fetch(`/api/clinics/${clinicId}/credentials`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        loginEmail: email,
        password: password || undefined,
      }),
    });

    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setMessage(body?.error ?? "Failed to update credentials");
      return;
    }

    setPassword("");
    setMessage("Credentials updated.");
    router.refresh();
  }

  return (
    <div className="p-5 space-y-4">
      {message && (
        <div className="text-xs text-muted-foreground">{message}</div>
      )}
      <label className="block">
        <div className="text-xs text-muted-foreground mb-1.5">Portal email</div>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="portal@clinic.co.uk"
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 max-w-md"
        />
      </label>
      <label className="block">
        <div className="text-xs text-muted-foreground mb-1.5">New password</div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Leave blank to keep current"
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 max-w-md"
        />
      </label>
      <div className="pt-1">
        <Button size="sm" onClick={onSave} disabled={saving || !email}>
          {saving ? "Saving…" : "Save credentials"}
        </Button>
      </div>
    </div>
  );
}
