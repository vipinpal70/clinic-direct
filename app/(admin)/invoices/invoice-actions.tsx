"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileDown, Send, Mail, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { notifyEmailSent, notifyEmailFailed, toast } from "@/lib/toast";

interface PeriodOption {
  period: string;
  count: number;
}

export function GenerateInvoicesButton({ periods }: { periods: PeriodOption[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [period, setPeriod] = useState(periods[0]?.period ?? "");

  const nothingToDo = periods.length === 0;

  async function onClick() {
    if (!period) return;
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period }),
    });
    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setMessage(body?.error ?? "Nothing to generate");
      return;
    }
    router.refresh();
  }

  if (nothingToDo) {
    return (
      <Button variant="outline" size="sm" disabled>
        <FileDown className="h-4 w-4" />
        No commissions to invoice
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          disabled={loading}
          className="h-9 rounded-md border border-input bg-card px-2 text-sm"
          aria-label="Commission period to invoice"
        >
          {periods.map((p) => (
            <option key={p.period} value={p.period}>
              {p.period} ({p.count})
            </option>
          ))}
        </select>
        <Button variant="outline" size="sm" onClick={onClick} disabled={loading}>
          <FileDown className="h-4 w-4" />
          {loading ? "Generating…" : "Generate invoices"}
        </Button>
      </div>
      {message && <span className="text-xs text-muted-foreground">{message}</span>}
    </div>
  );
}

interface RowActionsProps {
  invoiceId: string;
  number: string;
  status: string;
  /** True only for finance users — gates the "Mark as Paid" action. */
  canMarkPaid: boolean;
  /** Whether the clinic has an email on file (disables "Send Invoice" if not). */
  hasClinicEmail: boolean;
}

/** Per-invoice actions: Send Invoice (email) and Mark as Paid (finance-only). */
export function InvoiceRowActions({
  invoiceId,
  number,
  status,
  canMarkPaid,
  hasClinicEmail,
}: RowActionsProps) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [paying, setPaying] = useState(false);
  const isPaid = status === "paid";

  async function handleSend() {
    setSending(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/send`, {
        method: "POST",
      });
      const body = await res.json().catch(() => null);
      if (res.ok) {
        notifyEmailSent("Invoice", body?.recipient);
      } else {
        notifyEmailFailed("Invoice", body?.error ?? "Please try again");
      }
    } catch {
      notifyEmailFailed("Invoice", "Network error");
    } finally {
      setSending(false);
    }
  }

  async function handleMarkPaid() {
    setPaying(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "paid" }),
      });
      const body = await res.json().catch(() => null);
      if (res.ok) {
        toast.success(`Invoice ${number} marked as paid`);
        router.refresh(); // reflect the new status immediately
      } else {
        toast.error(body?.error ?? "Could not update invoice status");
      }
    } catch {
      toast.error("Network error while updating invoice");
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Button
        variant="outline"
        size="sm"
        onClick={handleSend}
        disabled={sending || !hasClinicEmail}
        title={
          hasClinicEmail
            ? "Email this invoice to the clinic"
            : "Clinic has no email address on file"
        }
      >
        <Mail className="h-4 w-4" />
        {sending ? "Sending…" : "Send"}
      </Button>

      {/* Mark as Paid is finance-only and hidden once the invoice is paid. */}
      {canMarkPaid && !isPaid && (
        <Button size="sm" onClick={handleMarkPaid} disabled={paying}>
          <CheckCircle2 className="h-4 w-4" />
          {paying ? "Saving…" : "Mark paid"}
        </Button>
      )}
    </div>
  );
}

export function PushQueuedButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    const res = await fetch("/api/invoices/push", { method: "POST" });
    setLoading(false);
    if (res.ok) router.refresh();
  }

  return (
    <Button size="sm" onClick={onClick} disabled={loading || disabled}>
      <Send className="h-4 w-4" />
      {loading ? "Pushing…" : "Push queued"}
    </Button>
  );
}
