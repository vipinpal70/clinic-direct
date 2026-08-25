"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, Send, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/shared/status-pill";

interface Props {
  clinicId: string;
  code: string;
  agreement: string; // not_sent | sent | viewed | accepted
  commissionPct: number;
  agreementCommissionPct: number | null;
  agreementExpiry: string | null;
  agreementLocked: boolean;
  agreementSignedName: string | null;
  detailsSubmitted: boolean;
}

function CopyLink({ label, path }: { label: string; path: string }) {
  const [copied, setCopied] = useState(false);
  const url =
    typeof window !== "undefined" ? `${window.location.origin}${path}` : path;

  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1.5">{label}</div>
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={url}
          className="h-9 flex-1 rounded-md border border-input bg-muted/40 px-3 text-xs font-mono text-muted-foreground"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

export function AgreementPanel({
  clinicId,
  code,
  agreement,
  commissionPct,
  agreementCommissionPct,
  agreementExpiry,
  agreementLocked,
  agreementSignedName,
  detailsSubmitted,
}: Props) {
  const router = useRouter();
  const [pct, setPct] = useState(String(agreementCommissionPct ?? commissionPct));
  const [expiry, setExpiry] = useState(
    agreementExpiry ? agreementExpiry.slice(0, 10) : defaultExpiry(),
  );
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentLink, setSentLink] = useState<string | null>(null);

  const statusTone =
    agreement === "accepted"
      ? "success"
      : agreement === "viewed"
        ? "info"
        : agreement === "sent"
          ? "warning"
          : "muted";

  async function handleSend() {
    setError(null);
    setSending(true);
    const res = await fetch(`/api/clinics/${clinicId}/agreement`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        commissionPct: Number(pct),
        expiry: new Date(expiry).toISOString(),
      }),
    });
    setSending(false);
    if (res.ok) {
      const { data } = await res.json();
      setSentLink(data.link);
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to send agreement");
    }
  }

  return (
    <div className="p-5 space-y-6">
      {/* Step 1 — details intake link */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">Clinic details link</h4>
          <StatusPill tone={detailsSubmitted ? "success" : "muted"}>
            {detailsSubmitted ? "Details submitted" : "Awaiting details"}
          </StatusPill>
        </div>
        <p className="text-xs text-muted-foreground">
          Send this to the clinic to collect bank &amp; tax details Shopify
          can&apos;t provide.
        </p>
        <CopyLink label="Public intake URL" path={`/clinic/details/${code}`} />
      </div>

      <div className="border-t border-border" />

      {/* Step 2 — agreement */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">Partnership agreement</h4>
          <StatusPill tone={statusTone}>
            Agreement {agreement.replace("_", " ")}
          </StatusPill>
        </div>

        {agreementLocked ? (
          <div className="flex items-start gap-3 rounded-lg bg-muted/40 p-4">
            <Lock className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Approved &amp; locked</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                Commission fixed at <strong>{commissionPct}%</strong>
                {agreementSignedName
                  ? ` · signed by ${agreementSignedName}`
                  : ""}
                . This agreement can no longer be edited.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">
                  Commission rate (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={pct}
                  onChange={(e) => setPct(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">
                  Expiry date
                </label>
                <input
                  type="date"
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                />
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button size="sm" onClick={handleSend} disabled={sending}>
              <Send className="h-4 w-4" />
              {sending
                ? "Sending…"
                : agreement === "not_sent"
                  ? "Send agreement"
                  : "Resend agreement"}
            </Button>

            {(sentLink || agreement !== "not_sent") && (
              <CopyLink
                label="Public agreement URL"
                path={sentLink ?? `/clinic/consent/${code}`}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function defaultExpiry(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}
