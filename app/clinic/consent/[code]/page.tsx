"use client";

import { use, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

interface AgreementData {
  clinicName: string;
  html: string;
  ref: string;
  expired: boolean;
  accepted: boolean;
  signedName: string | null;
  acceptedAt: string | null;
}

export default function ConsentPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const router = useRouter();
  const search = useSearchParams();
  const aid = search.get("aid");

  const [data, setData] = useState<AgreementData | null>(null);
  const [state, setState] = useState<
    "loading" | "ready" | "invalid" | "expired" | "accepted"
  >("loading");
  const [checked, setChecked] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!aid) return setState("invalid");
    fetch(`/api/portal/${code}/agreement?aid=${aid}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(({ data }: { data: AgreementData }) => {
        setData(data);
        if (data.accepted) setState("accepted");
        else if (data.expired) setState("expired");
        else setState("ready");
      })
      .catch(() => setState("invalid"));
  }, [aid, code]);

  async function handleAccept() {
    setError(null);
    if (!checked) return setError("Please confirm you agree to the terms.");
    if (!name.trim()) return setError("Enter your name to sign.");

    setSubmitting(true);
    const res = await fetch(`/api/portal/${code}/agreement`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aid, signedName: name.trim() }),
    });
    setSubmitting(false);

    if (res.ok) {
      setData((d) =>
        d
          ? { ...d, accepted: true, signedName: name.trim(), acceptedAt: new Date().toISOString() }
          : d,
      );
      setState("accepted");
      // Reflect acceptance in the URL. Keep `aid` so the verify effect's deps
      // don't change (dropping it would re-run the effect and flag "invalid").
      router.replace(`/clinic/consent/${code}?aid=${aid}&approved=true`);
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please try again.");
    }
  }

  return (
    <div className="page-bg">
      <style>{CSS}</style>
      <div className="page">
        <div className="card">
          <div className="header">
            <div className="brand-row">
              <div className="brand">
                <div className="logo">CD</div>
                <span className="brand-name">Clinic Direct</span>
              </div>
              {data && <span className="ref">Ref. {data.ref}</span>}
            </div>
            <h1>Partnership agreement</h1>
            {data && (
              <p className="subtitle">Prepared for {data.clinicName}</p>
            )}
          </div>

          {state === "loading" && (
            <div className="body">Loading agreement…</div>
          )}
          {state === "invalid" && (
            <div className="body">This link is invalid.</div>
          )}
          {state === "expired" && (
            <div className="body">
              This agreement link has expired. Please contact Clinic Direct for
              a new one.
            </div>
          )}

          {state === "ready" && data && (
            <div className="body">
              <div dangerouslySetInnerHTML={{ __html: data.html }} />

              <div className="signature-section">
                <label className="consent-row">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => setChecked(e.target.checked)}
                  />
                  <span className="consent-text">
                    I have read and agree to the terms above on behalf of{" "}
                    {data.clinicName}.
                  </span>
                </label>

                <label className="field-label" htmlFor="sign-name">
                  Type your full name to sign
                </label>
                <input
                  id="sign-name"
                  type="text"
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                {error && <p className="error-text-shown">{error}</p>}

                <button
                  className="accept-btn"
                  onClick={handleAccept}
                  disabled={submitting}
                >
                  {submitting ? "Signing…" : "Sign and accept"}
                </button>
              </div>
            </div>
          )}

          {state === "accepted" && (
            <div className="accepted-view-shown">
              <div className="check-circle">✓</div>
              <p className="accepted-title">Agreement signed</p>
              <p className="accepted-sub">
                {data?.signedName
                  ? `Signed by ${data.signedName}`
                  : "Signed"}
                {data?.acceptedAt
                  ? ` on ${dateFmt.format(new Date(data.acceptedAt))}`
                  : ""}
                . Clinic Direct will confirm activation shortly.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const CSS = `
  .page-bg { min-height: 100vh; padding: 40px 20px; background: #F1EFE8;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #2C2C2A; }
  .page { max-width: 640px; margin: 0 auto; }
  .card { background: #FFFFFF; border-radius: 12px; border: 1px solid #E3E1D8; overflow: hidden; }
  .header { padding: 32px 40px 24px; border-bottom: 1px solid #E3E1D8; }
  .brand-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
  .brand { display: flex; align-items: center; gap: 10px; }
  .logo { width: 32px; height: 32px; border-radius: 8px; background: #007A72; display: flex;
    align-items: center; justify-content: center; color: #fff; font-size: 13px; font-weight: 600; }
  .brand-name { font-size: 14px; font-weight: 600; }
  .ref { font-size: 12px; color: #888780; }
  h1 { font-size: 24px; font-weight: 600; margin: 0 0 6px; }
  .subtitle { font-size: 13px; color: #5F5E5A; margin: 0; }
  .body { padding: 32px 40px; }
  .summary-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 32px; }
  .summary-item { background: #F8F7F3; border-radius: 8px; padding: 12px 14px; }
  .summary-label { font-size: 12px; color: #888780; margin: 0 0 4px; }
  .summary-value { font-size: 14px; font-weight: 600; margin: 0; }
  .clause { display: flex; gap: 10px; font-size: 15px; line-height: 1.7; margin: 0 0 14px; }
  .clause:last-of-type { margin-bottom: 0; }
  .clause-num { color: #888780; font-weight: 600; min-width: 18px; }
  .expiry-note { margin-top: 24px; padding: 12px 14px; background: #FAEEDA; border-radius: 8px;
    display: flex; gap: 8px; align-items: flex-start; font-size: 13px; color: #633806; }
  .signature-section { margin-top: 32px; padding-top: 24px; border-top: 1px solid #E3E1D8; }
  .consent-row { display: flex; align-items: flex-start; gap: 10px; cursor: pointer; margin-bottom: 20px; }
  .consent-row input[type="checkbox"] { margin-top: 3px; width: 16px; height: 16px; accent-color: #007A72; }
  .consent-text { font-size: 14px; color: #5F5E5A; }
  label.field-label { display: block; font-size: 13px; color: #5F5E5A; margin-bottom: 6px; }
  input[type="text"] { width: 100%; height: 40px; padding: 0 12px; border-radius: 8px;
    border: 1px solid #D3D1C7; font-size: 14px; font-family: inherit; outline: none; }
  input[type="text"]:focus { border-color: #007A72; box-shadow: 0 0 0 3px rgba(0, 122, 114, 0.12); }
  .error-text-shown { font-size: 13px; color: #A32D2D; margin: 6px 0 0; }
  .accept-btn { margin-top: 20px; width: 100%; background: #007A72; color: #fff; border: none;
    height: 44px; border-radius: 8px; font-size: 14px; font-weight: 600; font-family: inherit; cursor: pointer; }
  .accept-btn:hover { background: #085041; }
  .accept-btn:disabled { opacity: 0.5; cursor: default; }
  .accepted-view-shown { padding: 56px 40px; text-align: center; }
  .check-circle { width: 48px; height: 48px; border-radius: 50%; background: #EAF3DE; display: flex;
    align-items: center; justify-content: center; margin: 0 auto 14px; font-size: 22px; color: #27500A; }
  .accepted-title { font-weight: 600; font-size: 16px; margin: 0 0 4px; }
  .accepted-sub { font-size: 13px; color: #5F5E5A; margin: 0; }
`;
