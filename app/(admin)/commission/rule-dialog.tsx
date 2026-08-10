"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface Rule {
  id: string;
  scope: string;
  scopeLabel: string;
  basis: string;
  value: number;
  appliesToLabel: string;
  priority: number;
  active: boolean;
}

export function RuleDialog({ rule }: { rule?: Rule }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    scope: rule?.scope ?? "",
    scopeLabel: rule?.scopeLabel ?? "",
    basis: rule?.basis ?? "percentage",
    value: String(rule?.value ?? ""),
    appliesToLabel: rule?.appliesToLabel ?? "",
    priority: String(rule?.priority ?? 0),
  });

  function update(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      ...form,
      value: parseFloat(form.value) || 0,
      priority: parseInt(form.priority, 10) || 0,
    };

    const res = await fetch(rule ? `/api/commission-rules/${rule.id}` : "/api/commission-rules", {
      method: rule ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Failed to save rule");
      return;
    }

    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {rule ? (
        <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Add rule
        </Button>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{rule ? "Edit commission rule" : "Add commission rule"}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit}>
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {!rule && (
              <div className="col-span-2">
                <Label className="text-xs">
                  Scope key (e.g. default, clinic:&#123;id&#125;, product:&#123;id&#125;)
                </Label>
                <Input className="mt-1.5" value={form.scope} onChange={(e) => update("scope", e.target.value)} required />
              </div>
            )}
            <div className="col-span-2">
              <Label className="text-xs">Scope label</Label>
              <Input className="mt-1.5" value={form.scopeLabel} onChange={(e) => update("scopeLabel", e.target.value)} required />
            </div>
            <div>
              <Label className="text-xs">Basis</Label>
              <select
                className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.basis}
                onChange={(e) => update("basis", e.target.value)}
              >
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Value</Label>
              <Input type="number" step={0.1} className="mt-1.5" value={form.value} onChange={(e) => update("value", e.target.value)} required />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Applies to</Label>
              <Input className="mt-1.5" value={form.appliesToLabel} onChange={(e) => update("appliesToLabel", e.target.value)} required />
            </div>
            <div>
              <Label className="text-xs">Priority</Label>
              <Input type="number" className="mt-1.5" value={form.priority} onChange={(e) => update("priority", e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : "Save rule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
