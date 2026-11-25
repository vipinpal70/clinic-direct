import Link from "next/link";
import {
  Banknote,
  Building2,
  CheckCircle2,
  FileSignature,
  Send,
  ShieldCheck,
} from "lucide-react";
import { PageHeader, PageBody } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { detailsPath } from "@/lib/portal-token";
import { cn, dateFmt, displayClinicCode, timeFmt } from "@/lib/utils";
import {
  agreementWasSent,
  APPROVAL_STAGES,
  APPROVAL_STAGE_LABEL,
  APPROVAL_STAGE_TONE,
  approvalBlocker,
  approvalStage,
  CLINIC_STATUS_LABEL,
  CLINIC_STATUS_TONE,
  clinicHasSigned,
  inApprovalPipeline,
  type ApprovalStage,
} from "@/lib/clinic-status";
import { ApproveButton } from "./approve-button";
import { AgreementDialog } from "./agreement-dialog";

export const metadata = { title: "Approvals" };
export const dynamic = "force-dynamic";

const STEPS = [
  { label: "Clinic registered", icon: Building2 },
  { label: "Agreement sent", icon: Send },
  { label: "Details submitted", icon: Banknote },
  { label: "Agreement signed", icon: FileSignature },
  { label: "Admin approved", icon: ShieldCheck },
];

const EMPTY: Record<"waiting" | ApprovalStage, string> = {
  waiting: "No clinics are waiting for approval.",
  new: "No new clinics. They appear here when Shopify sends a customer with a clinic code.",
  sent: "No agreements are waiting on a clinic.",
  ready: "No clinics are ready for your approval yet.",
  approved: "No clinics have been approved yet.",
};

interface Props {
  searchParams: Promise<{ stage?: string | string[] }>;
}

export default async function ApprovalsPage({ searchParams }: Props) {
  const { stage } = await searchParams;
  const view =
    APPROVAL_STAGES.find((s) => s === stage) ?? ("waiting" as const);

  // Filtered in code: the stage depends on several dates, and older records can
  // be missing fields that a MongoDB filter wouldn't match.
  const all = (await prisma.clinic.findMany({ orderBy: { createdAt: "desc" } }))
    .filter(inApprovalPipeline)
    .map((c) => ({ ...c, stage: approvalStage(c) }));

  const count = (s: ApprovalStage) => all.filter((c) => c.stage === s).length;
  const tabs = [
    { key: "waiting" as const, label: "All waiting", count: all.length - count("approved") },
    ...APPROVAL_STAGES.map((s) => ({ key: s, label: APPROVAL_STAGE_LABEL[s], count: count(s) })),
  ];
  const clinics = all.filter((c) =>
    view === "waiting" ? c.stage !== "approved" : c.stage === view,
  );

  return (
    <>
      <PageHeader
        title="Clinic approvals"
        description="Newly registered clinics start here. Send the agreement, wait for the clinic to submit its details and sign, then approve. Commission counts orders from the approval time."
      />
      <PageBody>
        <SectionCard title="Approval workflow">
          <ol className="flex flex-col md:flex-row md:items-center gap-4 md:gap-0 p-6">
            {STEPS.map((s, i) => (
              <li key={s.label} className="flex-1 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full border-2 border-border bg-card flex items-center justify-center shrink-0">
                  <s.icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Step {i + 1}
                  </div>
                  <div className="text-sm font-medium">{s.label}</div>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block flex-1 h-px bg-border mx-3" />
                )}
              </li>
            ))}
          </ol>
        </SectionCard>

        <SectionCard
          title={view === "waiting" ? "Waiting for approval" : APPROVAL_STAGE_LABEL[view]}
          description={`${clinics.length} clinic${clinics.length === 1 ? "" : "s"}`}
        >
          <nav
            aria-label="Approval stage"
            className="flex gap-1 overflow-x-auto border-b border-border px-5"
          >
            {tabs.map((t) => (
              <Link
                key={t.key}
                href={t.key === "waiting" ? "/approvals" : `/approvals?stage=${t.key}`}
                aria-current={view === t.key ? "page" : undefined}
                className={cn(
                  "-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors",
                  view === t.key
                    ? "border-primary font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}{" "}
                <span className="tabular-nums text-xs text-muted-foreground">({t.count})</span>
              </Link>
            ))}
          </nav>

          <div className="divide-y divide-border">
            {clinics.length === 0 && (
              <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
                <CheckCircle2 className="h-10 w-10 text-success/50" aria-hidden />
                <p className="text-sm text-muted-foreground">{EMPTY[view]}</p>
              </div>
            )}
            {clinics.map((c) => {
              const approved = c.stage === "approved";
              const signed = approved || clinicHasSigned(c);
              const done = [
                true,
                approved || agreementWasSent(c),
                Boolean(c.detailsSubmittedAt),
                signed,
                approved,
              ];
              const expired =
                !signed &&
                agreementWasSent(c) &&
                c.agreementExpiry !== null &&
                c.agreementExpiry < new Date();

              return (
                <div
                  key={c.id}
                  className="flex flex-col lg:flex-row lg:items-center gap-4 px-5 py-4"
                >
                  <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center text-xs font-bold text-accent-foreground shrink-0">
                    {displayClinicCode(c)?.slice(-3)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{c.name}</span>
                      <StatusPill tone={APPROVAL_STAGE_TONE[c.stage]}>
                        {APPROVAL_STAGE_LABEL[c.stage]}
                      </StatusPill>
                      {approved && c.status !== "active" && (
                        <StatusPill tone={CLINIC_STATUS_TONE[c.status]}>
                          {CLINIC_STATUS_LABEL[c.status]}
                        </StatusPill>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground break-words">
                      {c.clinicCode ?? c.code} · {c.email || "No email"} · Joined {dateFmt(c.joined)}
                    </div>
                    {!approved && c.status === "active" && (
                      <div className="text-xs text-warning-foreground mt-0.5">
                        Marked Active by an older import, but never approved
                      </div>
                    )}
                    {expired && (
                      <div className="text-xs text-destructive mt-0.5">
                        Agreement link expired {dateFmt(c.agreementExpiry)}. Resend it.
                      </div>
                    )}
                  </div>

                  <ul className="flex items-center gap-1" aria-label="Progress">
                    {STEPS.map((s, i) => (
                      <li
                        key={s.label}
                        title={`${s.label}: ${done[i] ? "done" : "not yet"}`}
                        className={cn(
                          "h-7 w-7 rounded-full flex items-center justify-center",
                          done[i]
                            ? "bg-success/20 text-success"
                            : "bg-muted text-muted-foreground/50",
                        )}
                      >
                        <s.icon className="h-3.5 w-3.5" aria-hidden />
                        <span className="sr-only">
                          {s.label}: {done[i] ? "done" : "not yet"}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {approved ? (
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right text-xs text-muted-foreground">
                        {c.activatedAt || c.agreementApprovedAt ? (
                          <div>
                            Approved {dateFmt(c.activatedAt ?? c.agreementApprovedAt)}{" "}
                            {timeFmt(c.activatedAt ?? c.agreementApprovedAt)}
                          </div>
                        ) : (
                          <div>Approved</div>
                        )}
                        <div>
                          {c.commissionPct}% commission
                          {c.agreementSignedName ? ` · signed by ${c.agreementSignedName}` : ""}
                        </div>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/clinics/${c.id}`}>View</Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 shrink-0">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/clinics/${c.id}`}>Review</Link>
                      </Button>
                      <AgreementDialog
                        clinicId={c.id}
                        clinicName={c.name}
                        code={c.code}
                        detailsPath={detailsPath(c)}
                        agreement={c.agreement}
                        commissionPct={c.commissionPct}
                        agreementCommissionPct={c.agreementCommissionPct ?? null}
                        agreementExpiry={
                          c.agreementExpiry ? c.agreementExpiry.toISOString() : null
                        }
                        agreementLocked={c.agreementLocked}
                        agreementSignedName={c.agreementSignedName ?? null}
                        detailsSubmitted={Boolean(c.detailsSubmittedAt)}
                        emailSentCount={c.emailSentCount}
                        emailSentAt={c.emailSentAt ? c.emailSentAt.toISOString() : null}
                      />
                      <ApproveButton clinicId={c.id} blocker={approvalBlocker(c)} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>
      </PageBody>
    </>
  );
}
