"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileSignature,
  Mail,
  Send,
  Lock,
  Check,
  Copy,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notifyEmailSent, notifyEmailFailed } from "@/lib/toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";

export interface SendAgreementClinic {
  id: string;
  name: string;
  email: string;
  code: string;
  commissionPct?: number;
  agreement?: string; // not_sent | sent | viewed | accepted
  agreementLocked?: boolean;
}

interface Props {
  clinic: SendAgreementClinic;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  buttonText?: string;
}

function defaultExpiry(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

export function SendAgreementDialog({
  clinic,
  variant = "outline",
  size = "sm",
  className,
  buttonText,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [commissionPct, setCommissionPct] = useState(
    String(clinic.commissionPct ?? 12),
  );
  const [expiry, setExpiry] = useState(defaultExpiry());
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentResult, setSentResult] = useState<{
    link: string;
    emailed: boolean;
    emailError?: string | null;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const isLocked = Boolean(clinic.agreementLocked);
  const isResend = clinic.agreement && clinic.agreement !== "not_sent";

  const triggerLabel =
    buttonText ??
    (isLocked
      ? "Agreement locked"
      : isResend
        ? "Resend Agreement"
        : "Send Agreement");

  function resetState() {
    setError(null);
    setSentResult(null);
    setCommissionPct(String(clinic.commissionPct ?? 12));
    setExpiry(defaultExpiry());
    setCopied(false);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!clinic.email) {
      setError("This clinic has no email address on file.");
      return;
    }

    const pctNum = parseFloat(commissionPct);
    if (isNaN(pctNum) || pctNum < 0 || pctNum > 100) {
      setError("Please enter a valid commission rate between 0% and 100%.");
      return;
    }

    if (!expiry || new Date(expiry) <= new Date()) {
      setError("Expiry date must be in the future.");
      return;
    }

    setSending(true);
    setError(null);

    try {
      const res = await fetch(`/api/clinics/${clinic.id}/agreement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commissionPct: pctNum,
          expiry: new Date(expiry).toISOString(),
        }),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = body.error ?? "Failed to send agreement";
        setError(msg);
        notifyEmailFailed("Agreement", msg);
        setSending(false);
        return;
      }

      setSentResult({
        link: body.data?.link,
        emailed: body.data?.emailed,
        emailError: body.data?.emailError,
      });
      if (body.data?.emailed) {
        notifyEmailSent("Agreement", clinic.email);
      } else {
        notifyEmailFailed("Agreement", body.data?.emailError);
      }
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(msg);
      notifyEmailFailed("Agreement", msg);
    } finally {
      setSending(false);
    }
  }

  const fullUrl =
    sentResult?.link && typeof window !== "undefined"
      ? `${window.location.origin}${sentResult.link}`
      : sentResult?.link ?? "";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) resetState();
      }}
    >
      <DialogTrigger asChild>
        {isLocked ? (
          <Button
            variant={variant}
            size={size}
            disabled
            className={className}
            title="Agreement is approved and locked"
          >
            <Lock className="h-3.5 w-3.5" />
            <span>{triggerLabel}</span>
          </Button>
        ) : (
          <Button variant={variant} size={size} className={className}>
            <Mail className="h-3.5 w-3.5" />
            <span>{triggerLabel}</span>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-primary" />
            Send Partnership Agreement
          </DialogTitle>
          <DialogDescription>
            Freeze the terms and email the agreement signing link to{" "}
            <strong>{clinic.name}</strong>.
          </DialogDescription>
        </DialogHeader>

        {sentResult ? (
          <div className="space-y-4 py-2">
            {sentResult.emailed ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-800 p-3.5 text-sm text-emerald-800 dark:text-emerald-200 flex items-start gap-2.5">
                <Check className="h-4 w-4 mt-0.5 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-semibold">Email sent successfully!</p>
                  <p className="text-xs mt-0.5 opacity-90">
                    The agreement signing form was emailed to{" "}
                    <span className="font-mono underline">{clinic.email}</span>.
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 p-3.5 text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
                <div>
                  <p className="font-semibold">Agreement created, but email failed</p>
                  <p className="text-xs mt-0.5 opacity-90">
                    {sentResult.emailError ?? "Unable to deliver email via SMTP."}
                  </p>
                </div>
              </div>
            )}

            {fullUrl && (
              <div className="space-y-1.5 pt-1">
                <div className="text-xs font-medium text-muted-foreground">
                  Signing link (also sent in email):
                </div>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={fullUrl}
                    className="h-9 flex-1 rounded-md border border-input bg-muted/40 px-3 text-xs font-mono text-muted-foreground"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(fullUrl);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full sm:w-auto"
              >
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSend} className="space-y-4">
            {/* Clinic details banner */}
            <div className="rounded-lg border border-border bg-muted/30 p-3.5 text-xs space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Recipient Email:</span>
                <span className="font-semibold font-mono text-foreground">
                  {clinic.email || (
                    <span className="text-destructive">No email set</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Clinic Code:</span>
                <span className="font-mono text-foreground">{clinic.code}</span>
              </div>
            </div>

            {!clinic.email && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>
                  Please edit this clinic to add an email address before sending
                  the agreement.
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="comm-pct" className="text-xs">
                  Commission rate (%)
                </Label>
                <Input
                  id="comm-pct"
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={commissionPct}
                  onChange={(e) => setCommissionPct(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="expiry-date" className="text-xs">
                  Valid until
                </Label>
                <Input
                  id="expiry-date"
                  type="date"
                  value={expiry}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setExpiry(e.target.value)}
                  required
                />
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              When triggered, an email will be delivered to{" "}
              <strong>{clinic.email}</strong> with a secure link to review and
              electronically sign their partnership agreement.
            </p>

            {error && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={sending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={sending || !clinic.email}
                className="gap-1.5"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending Email…
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    {isResend ? "Resend Agreement Email" : "Send Agreement Email"}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
