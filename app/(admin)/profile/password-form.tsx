"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setMessage("New passwords don't match.");
      return;
    }

    setSaving(true);
    const res = await fetch("/api/profile/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    setSaving(false);

    const body = await res.json().catch(() => null);
    if (!res.ok) {
      setMessage(body?.error ?? "Failed to update password.");
      return;
    }

    setMessage("Password updated.");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 max-w-sm">
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
      <FieldInput label="Current password" value={currentPassword} onChange={setCurrentPassword} />
      <FieldInput label="New password" value={newPassword} onChange={setNewPassword} />
      <FieldInput label="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} />
      <Button type="submit" size="sm" disabled={saving}>
        {saving ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}

function FieldInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <div className="text-xs text-muted-foreground mb-1.5">{label}</div>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
      />
    </label>
  );
}
