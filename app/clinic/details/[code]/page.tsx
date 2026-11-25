"use client";

import { use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface ClinicInfo {
  name: string;
  detailsSubmitted: boolean;
}

export default function ClinicDetailsPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const token = useSearchParams().get("t");
  const [info, setInfo] = useState<ClinicInfo | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "invalid" | "done">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [bank, setBank] = useState({
    accountHolderName: "",
    bankName: "",
    accountNumber: "",
    sortCode: "",
  });
  const [vatId, setVatId] = useState("");

  useEffect(() => {
    if (!token) return setState("invalid");
    fetch(`/api/portal/${code}`, { headers: { "x-portal-token": token } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(({ data }: { data: ClinicInfo }) => {
        setInfo(data);
        setState(data.detailsSubmitted ? "done" : "ready");
      })
      .catch(() => setState("invalid"));
  }, [code, token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/portal/${code}/details`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-portal-token": token ?? "" },
      body: JSON.stringify({ bankDetails: bank, taxExempt: { vatId } }),
    });
    setSaving(false);
    if (res.ok) {
      setState("done");
    } else {
      const body = await res.json().catch(() => ({}));
      const fieldErrors = body?.issues?.fieldErrors as
        | Record<string, string[]>
        | undefined;
      const messages = fieldErrors
        ? Object.values(fieldErrors).flat().filter(Boolean)
        : [];
      setError(
        messages.length
          ? messages.join(" ")
          : body.error ?? "Something went wrong. Please try again.",
      );
    }
  }

  if (state === "loading") return <Shell>Loading…</Shell>;
  if (state === "invalid")
    return (
      <Shell>
        <h1 className="text-xl font-semibold">Link not valid</h1>
        <p className="mt-2 text-sm text-[#5F5E5A]">
          This link is invalid or has expired. Please contact Clinic Direct for a
          new one.
        </p>
      </Shell>
    );

  if (state === "done")
    return (
      <Shell>
        <div className="text-center py-6">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#EAF3DE] text-2xl text-[#27500A]">
            ✓
          </div>
          <h1 className="text-lg font-semibold">Details received</h1>
          <p className="mt-1 text-sm text-[#5F5E5A]">
            Thank you — {info?.name} has submitted its details. Clinic Direct
            will be in touch with your partnership agreement.
          </p>
        </div>
      </Shell>
    );

  return (
    <Shell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Complete your details</h1>
        <p className="mt-1 text-sm text-[#5F5E5A]">
          {info?.name} · Provide your bank and tax information so Clinic Direct
          can set up self-billed payments.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <fieldset className="space-y-4">
          <legend className="text-xs font-semibold uppercase tracking-widest text-[#888780]">
            Bank details
          </legend>
          <TextField
            label="Account holder name"
            value={bank.accountHolderName}
            onChange={(v) => setBank({ ...bank, accountHolderName: v })}
            required
          />
          <TextField
            label="Bank name"
            value={bank.bankName}
            onChange={(v) => setBank({ ...bank, bankName: v })}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Account number"
              value={bank.accountNumber}
              onChange={(v) => setBank({ ...bank, accountNumber: v })}
              placeholder="12345678"
              required
            />
            <TextField
              label="Sort code"
              value={bank.sortCode}
              onChange={(v) => setBank({ ...bank, sortCode: v })}
              placeholder="00-00-00"
              required
            />
          </div>
        </fieldset>

        <fieldset className="space-y-4 border-t border-[#E3E1D8] pt-6">
          <legend className="text-xs font-semibold uppercase tracking-widest text-[#888780]">
            Tax information
          </legend>
          <TextField
            label="VAT number (if registered)"
            value={vatId}
            onChange={setVatId}
            placeholder="GB123456789"
          />
        </fieldset>

        {error && <p className="text-sm text-[#A32D2D]">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="h-11 w-full rounded-lg bg-[#007A72] text-sm font-semibold text-white transition-colors hover:bg-[#085041] disabled:opacity-50"
        >
          {saving ? "Submitting…" : "Submit details"}
        </button>
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F1EFE8] px-5 py-10 text-[#2C2C2A]">
      <div className="mx-auto max-w-xl">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#007A72] text-[13px] font-semibold text-white">
            CD
          </div>
          <span className="text-sm font-semibold">Clinic Direct</span>
        </div>
        <div className="rounded-xl border border-[#E3E1D8] bg-white p-8">
          {children}
        </div>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[13px] text-[#5F5E5A]">{label}</label>
      <input
        type="text"
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-lg border border-[#D3D1C7] px-3 text-sm outline-none focus:border-[#007A72] focus:ring-2 focus:ring-[#007A72]/15"
      />
    </div>
  );
}
