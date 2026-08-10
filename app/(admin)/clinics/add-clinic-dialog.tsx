"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export function AddClinicDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    code: "",
    email: "",
    phone: "",
    commissionPct: "12",
  });

  function update(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/clinics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        commissionPct: parseFloat(form.commissionPct) || 0,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Failed to create clinic");
      return;
    }

    setOpen(false);
    setForm({ name: "", code: "", email: "", phone: "", commissionPct: "12" });
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Add clinic
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add clinic</DialogTitle>
          <DialogDescription>
            Register a new clinic. It starts as pending until the agreement is
            accepted and an admin approves it.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit}>
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label htmlFor="name" className="text-xs">Clinic name</Label>
              <Input
                id="name"
                required
                className="mt-1.5"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="code" className="text-xs">Clinic code</Label>
              <Input
                id="code"
                required
                placeholder="ABC-001"
                className="mt-1.5"
                value={form.code}
                onChange={(e) => update("code", e.target.value.toUpperCase())}
              />
            </div>
            <div>
              <Label htmlFor="commissionPct" className="text-xs">Commission %</Label>
              <Input
                id="commissionPct"
                type="number"
                min={0}
                max={100}
                step={0.5}
                className="mt-1.5"
                value={form.commissionPct}
                onChange={(e) => update("commissionPct", e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="email" className="text-xs">Email</Label>
              <Input
                id="email"
                type="email"
                required
                className="mt-1.5"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="phone" className="text-xs">Phone (optional)</Label>
              <Input
                id="phone"
                className="mt-1.5"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating…" : "Create clinic"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
