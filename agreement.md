# Clinic Direct — Agreement Flow

One active agreement template. Per-clinic variance = `clinic_name` (auto-filled from existing data) + a small set of variables (e.g. `commission_rate`, `start_date`) admin fills in. Content is frozen into a snapshot at send time.

---

## 1. Models

```typescript
// models/AgreementTemplate.ts
import { Schema, model, models, Types } from "mongoose";

export interface IAgreementTemplate {
  _id: Types.ObjectId;
  name: string;
  content: string; // HTML with {{variable}} placeholders
  variables: string[]; // e.g. ['clinic_name', 'commission_rate', 'start_date']
  isActive: boolean;
  createdAt: Date;
}

const AgreementTemplateSchema = new Schema<IAgreementTemplate>(
  {
    name: { type: String, required: true },
    content: { type: String, required: true },
    variables: [{ type: String }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export default models.AgreementTemplate ||
  model<IAgreementTemplate>("AgreementTemplate", AgreementTemplateSchema);
```

Seed content example:

```html
<h1>Clinic Direct Partnership Agreement</h1>
<p>
  This agreement is between Clinic Direct and <strong>{{clinic_name}}</strong>.
</p>
<p>Commission rate: <strong>{{commission_rate}}</strong></p>
<p>Effective start date: <strong>{{start_date}}</strong></p>
<p>Payment terms: {{payment_terms}}</p>
```

You only ever need one document in this collection with `isActive: true`. Keeping it a collection (rather than a single config object) just means you can swap the active template later without a migration — nothing else in the code below changes if you do.

```typescript
// models/Clinic.ts (additions — schema must match interface, all three fields declared)
import { Schema, model, models, Types } from "mongoose";

interface IClinic {
  // ...existing fields

  agreement_status: boolean;
  agreementId?: string; // random, unique — used directly in the link, no hashing
  agreementCreatedAt?: Date;
  agreementExpiry?: Date;
  agreementSentAt?: Date;
  agreementAcceptedAt?: Date;

  agreementVariables?: Record<string, string>;
  agreementContentSnapshot?: string;
}

const ClinicSchema = new Schema<IClinic>({
  // ...existing fields

  agreement_status: { type: Boolean, default: false },
  agreementId: { type: String, index: true }, // indexed since verify/accept look up by this
  agreementCreatedAt: Date,
  agreementExpiry: Date,
  agreementSentAt: Date,
  agreementAcceptedAt: Date,

  agreementVariables: { type: Schema.Types.Mixed },
  agreementContentSnapshot: String,
});
```

Note there's no `agreementTemplateId` here — since there's only ever one active template, there's nothing to reference per clinic.

```typescript
// lib/agreementId.ts
import crypto from "crypto";

export function generateAgreementId() {
  return crypto.randomBytes(24).toString("hex"); // 48-char hex, no hashing needed
}
```

```typescript
// lib/mergeTemplate.ts
export function mergeTemplate(
  content: string,
  variables: Record<string, string>,
): string {
  return content.replace(
    /\{\{(\w+)\}\}/g,
    (match, key) => variables[key] ?? match,
  );
}

export function findMissingVariables(
  templateVariables: string[],
  values: Record<string, string>,
): string[] {
  return templateVariables.filter((key) => !values[key]?.trim());
}
```

```typescript
// lib/getActiveTemplate.ts
import AgreementTemplate from "@/models/AgreementTemplate";

export async function getActiveTemplate() {
  const template = await AgreementTemplate.findOne({ isActive: true });
  if (!template) throw new Error("No active agreement template configured");
  return template;
}
```

```typescript
// lib/buildAgreementVariables.ts
import { IClinic } from "@/models/Clinic";

export function buildAgreementVariables(
  clinic: IClinic,
  adminInput: Record<string, string>,
) {
  return {
    clinic_name: clinic.name, // pulled from existing data — never re-entered
    ...adminInput, // e.g. { commission_rate: '15%', start_date: '2026-09-01' }
  };
}
```

---

## 2. Admin fills in the non-derived variables

```typescript
// app/api/clinics/[clinicId]/agreement-variables/route.ts
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Clinic from "@/models/Clinic";

export async function PUT(
  req: NextRequest,
  { params }: { params: { clinicId: string } },
) {
  const { variables } = await req.json(); // e.g. { commission_rate: '15%', start_date: '2026-09-01' }

  await dbConnect();

  await Clinic.updateOne(
    { clinicId: params.clinicId },
    { agreementVariables: variables },
  );

  return NextResponse.json({ success: true });
}
```

```typescript
// app/api/clinics/[clinicId]/agreement-preview/route.ts
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Clinic from "@/models/Clinic";
import { getActiveTemplate } from "@/lib/getActiveTemplate";
import { buildAgreementVariables } from "@/lib/buildAgreementVariables";
import { mergeTemplate, findMissingVariables } from "@/lib/mergeTemplate";

export async function GET(
  req: NextRequest,
  { params }: { params: { clinicId: string } },
) {
  await dbConnect();

  const clinic = await Clinic.findOne({ clinicId: params.clinicId });
  if (!clinic)
    return NextResponse.json({ error: "Clinic not found" }, { status: 404 });

  const template = await getActiveTemplate();
  const variables = buildAgreementVariables(
    clinic,
    clinic.agreementVariables ?? {},
  );
  const missing = findMissingVariables(template.variables, variables);

  return NextResponse.json({
    html: mergeTemplate(template.content, variables),
    missingVariables: missing,
    readyToSend: missing.length === 0,
  });
}
```

### Admin form — no template picker, `clinic_name` never shown as an input

```tsx
// app/admin/clinics/[clinicId]/agreement/page.tsx
"use client";

import { useEffect, useState } from "react";

export default function ClinicAgreementEditor({
  params,
}: {
  params: { clinicId: string };
}) {
  const [templateVariables, setTemplateVariables] = useState<string[]>([]);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<{
    html: string;
    missingVariables: string[];
    readyToSend: boolean;
  } | null>(null);

  useEffect(() => {
    fetch("/api/agreement-templates/active")
      .then((r) => r.json())
      .then((data) => setTemplateVariables(data.variables));
  }, []);

  const editableVariables = templateVariables.filter(
    (v) => v !== "clinic_name",
  );

  async function handleSaveAndPreview() {
    await fetch(`/api/clinics/${params.clinicId}/agreement-variables`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variables }),
    });
    const res = await fetch(
      `/api/clinics/${params.clinicId}/agreement-preview`,
    );
    setPreview(await res.json());
  }

  async function handleSend() {
    if (!preview?.readyToSend) return;
    await fetch(`/api/clinics/${params.clinicId}/send-agreement`, {
      method: "POST",
    });
  }

  return (
    <div className="max-w-3xl mx-auto py-8 space-y-6">
      {editableVariables.map((key) => (
        <div key={key}>
          <label className="block text-sm font-medium mb-1">{key}</label>
          <input
            className="border rounded px-3 py-2 w-full"
            value={variables[key] ?? ""}
            onChange={(e) =>
              setVariables({ ...variables, [key]: e.target.value })
            }
          />
        </div>
      ))}

      <button
        onClick={handleSaveAndPreview}
        className="border px-4 py-2 rounded"
      >
        Save & Preview
      </button>

      {preview && (
        <div className="border rounded p-4">
          <div dangerouslySetInnerHTML={{ __html: preview.html }} />
          {preview.missingVariables.length > 0 && (
            <p className="text-red-600 mt-2">
              Missing: {preview.missingVariables.join(", ")}
            </p>
          )}
        </div>
      )}

      <button
        onClick={handleSend}
        disabled={!preview?.readyToSend}
        className="bg-[#007A72] text-white px-6 py-3 rounded-lg disabled:opacity-40"
      >
        Send to Clinic
      </button>
    </div>
  );
}
```

---

## 3. Send — merges template + variables, freezes the snapshot

```typescript
// app/api/clinics/[clinicId]/send-agreement/route.ts
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Clinic from "@/models/Clinic";
import { getActiveTemplate } from "@/lib/getActiveTemplate";
import { buildAgreementVariables } from "@/lib/buildAgreementVariables";
import { mergeTemplate, findMissingVariables } from "@/lib/mergeTemplate";
import { generateAgreementId } from "@/lib/agreementId";
import { sendEmail } from "@/lib/email";

export async function POST(
  req: NextRequest,
  { params }: { params: { clinicId: string } },
) {
  await dbConnect();

  const clinic = await Clinic.findOne({ clinicId: params.clinicId });
  if (!clinic)
    return NextResponse.json({ error: "Clinic not found" }, { status: 404 });

  const template = await getActiveTemplate();
  const variables = buildAgreementVariables(
    clinic,
    clinic.agreementVariables ?? {},
  );
  const missing = findMissingVariables(template.variables, variables);
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Missing variables: ${missing.join(", ")}` },
      { status: 400 },
    );
  }

  const snapshot = mergeTemplate(template.content, variables);
  const agreementId = generateAgreementId();
  const expiry = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

  clinic.agreementContentSnapshot = snapshot;
  clinic.agreementId = agreementId;
  clinic.agreementExpiry = expiry;
  clinic.agreementSentAt = new Date();
  await clinic.save();

  const link = `${process.env.APP_URL}/custom-portal/agreement?agreement_id=${agreementId}`;

  await sendEmail({
    to: clinic.email,
    subject: "Please review your Clinic Direct agreement",
    html: `<p>Hi ${clinic.name},</p><p>Please review and accept your agreement to activate your Clinic Direct account.</p><a href="${link}">Review Agreement</a>`,
  });

  return NextResponse.json({ success: true });
}
```

---

## 4. Agreement page — verify now returns the snapshot, accept is unchanged

```typescript
// app/api/agreement/verify/route.ts
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Clinic from "@/models/Clinic";

export async function GET(req: NextRequest) {
  const agreementId = req.nextUrl.searchParams.get("agreement_id");
  if (!agreementId)
    return NextResponse.json({ error: "Missing params" }, { status: 400 });

  await dbConnect();

  const clinic = await Clinic.findOne({
    agreementId,
    agreementExpiry: { $gt: new Date() },
  });

  if (!clinic)
    return NextResponse.json(
      { error: "Invalid or expired link" },
      { status: 400 },
    );

  return NextResponse.json({
    valid: true,
    clinicName: clinic.name,
    html: clinic.agreementContentSnapshot,
    alreadyAccepted: clinic.agreement_status,
  });
}
```

```typescript
// app/api/agreement/accept/route.ts — no changes from your version, this part was already correct
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Clinic from "@/models/Clinic";
import { hashToken } from "@/lib/token";

export async function POST(req: NextRequest) {
  const { clinic_id, token } = await req.json();
  if (!clinic_id || !token) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  await dbConnect();

  const clinic = await Clinic.findOne({
    clinicId: clinic_id,
    agreementTokenHash: hashToken(token),
    agreementTokenExpiry: { $gt: new Date() },
    agreement_status: false,
  });

  if (!clinic) {
    return NextResponse.json(
      { error: "Invalid, expired, or already-accepted link" },
      { status: 400 },
    );
  }

  clinic.agreement_status = true;
  clinic.agreementAcceptedAt = new Date();
  await clinic.save();

  return NextResponse.json({ success: true });
}
```

```tsx
// app/custom-portal/agreement/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function AgreementPage() {
  const params = useSearchParams();
  const agreementId = params.get("agreement_id");

  const [state, setState] = useState<
    "loading" | "ready" | "invalid" | "accepted"
  >("loading");
  const [html, setHtml] = useState("");

  useEffect(() => {
    if (!agreementId) return setState("invalid");

    fetch(`/api/agreement/verify?agreement_id=${agreementId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.valid) return setState("invalid");
        if (data.alreadyAccepted) return setState("accepted");
        setHtml(data.html);
        setState("ready");
      })
      .catch(() => setState("invalid"));
  }, [agreementId]);

  async function handleAccept() {
    const res = await fetch("/api/agreement/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agreement_id: agreementId }),
    });
    if (res.ok) setState("accepted");
  }

  if (state === "loading") return <p>Loading agreement…</p>;
  if (state === "invalid") return <p>This link is invalid or has expired.</p>;
  if (state === "accepted")
    return <p>Agreement accepted. Thank you — your account is now active.</p>;

  return (
    <div className="max-w-2xl mx-auto py-12">
      <div dangerouslySetInnerHTML={{ __html: html }} />
      <button
        onClick={handleAccept}
        className="mt-6 bg-[#007A72] text-white px-6 py-3 rounded-lg"
      >
        I Accept the Agreement
      </button>
    </div>
  );
}
```
