"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Edit } from "lucide-react";
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

interface Props {
  clinic: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    address: string | null;
    website: string | null;
    commissionPct: number;
    notes: string | null;
  };
}

export function EditClinicDialog({ clinic }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: clinic.name,
    email: clinic.email,
    phone: clinic.phone ?? "",
    address: clinic.address ?? "",
    website: clinic.website ?? "",
    commissionPct: String(clinic.commissionPct),
    notes: clinic.notes ?? "",
  });

  function update(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/clinics/${clinic.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        commissionPct: parseFloat(form.commissionPct) || 0,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Failed to update clinic");
      return;
    }

    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Edit className="h-4 w-4" />
        Edit clinic
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit clinic</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit}>
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">Name</Label>
              <Input className="mt-1.5" value={form.name} onChange={(e) => update("name", e.target.value)} required />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Email</Label>
              <Input type="email" className="mt-1.5" value={form.email} onChange={(e) => update("email", e.target.value)} required />
            </div>
            <div>
              <Label className="text-xs">Phone</Label>
              <Input className="mt-1.5" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Commission %</Label>
              <Input type="number" min={0} max={100} step={0.5} className="mt-1.5" value={form.commissionPct} onChange={(e) => update("commissionPct", e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Address</Label>
              <Input className="mt-1.5" value={form.address} onChange={(e) => update("address", e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Website</Label>
              <Input className="mt-1.5" value={form.website} onChange={(e) => update("website", e.target.value)} placeholder="https://" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Notes</Label>
              <Input className="mt-1.5" value={form.notes} onChange={(e) => update("notes", e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
