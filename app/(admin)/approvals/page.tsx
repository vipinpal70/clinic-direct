import Link from "next/link";
import {
  FileSignature,
  Send,
  Eye,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import { PageHeader, PageBody } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { dateFmt } from "@/lib/utils";
import { ApproveButton } from "./approve-button";

export const metadata = { title: "Approvals" };
export const dynamic = "force-dynamic";

const STAGES = [
  { key: "created", label: "Clinic created", icon: FileSignature, step: 1 },
  { key: "sent", label: "Agreement sent", icon: Send, step: 2 },
  { key: "viewed", label: "Agreement viewed", icon: Eye, step: 3 },
  { key: "accepted", label: "Agreement accepted", icon: CheckCircle2, step: 4 },
  { key: "approved", label: "Admin approved", icon: ShieldCheck, step: 5 },
];

function getStageIndex(agreement: string): number {
  if (agreement === "not_sent") return 0;
  if (agreement === "sent") return 1;
  if (agreement === "viewed") return 2;
  if (agreement === "accepted") return 3;
  return -1; // fully approved
}

export default async function ApprovalsPage() {
  const pending = await prisma.clinic.findMany({
    where: { status: "pending" },
    orderBy: { joined: "desc" },
  });

  return (
    <>
      <PageHeader
        title="Clinic approvals"
        description="Track new clinics through the agreement and admin review pipeline. Commission is disabled until approval."
      />
      <PageBody>
        {/* Workflow diagram */}
        <SectionCard title="Approval workflow">
          <div className="p-6">
            <ol className="flex flex-col md:flex-row md:items-center gap-4 md:gap-0">
              {STAGES.map((s, i) => {
                const Icon = s.icon;
                return (
                  <li key={s.key} className="flex-1 flex items-center gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full border-2 border-border bg-card flex items-center justify-center shrink-0">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Step {s.step}
                        </div>
                        <div className="text-sm font-medium">{s.label}</div>
                      </div>
                    </div>
                    {i < STAGES.length - 1 && (
                      <div className="hidden md:block flex-1 h-px bg-border mx-3" />
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        </SectionCard>

        {/* Pending list */}
        <SectionCard
          title="Pending approvals"
          description={`${pending.length} clinic${pending.length !== 1 ? "s" : ""} waiting`}
        >
          <div className="divide-y divide-border">
            {pending.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <CheckCircle2 className="h-10 w-10 text-success/50" />
                <p className="text-sm text-muted-foreground">
                  Nothing pending — you&apos;re all caught up.
                </p>
              </div>
            )}
            {pending.map((c) => {
              const stageIdx = getStageIndex(c.agreement);
              return (
                <div key={c.id} className="flex flex-col md:flex-row md:items-center gap-4 px-5 py-4">
                  <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center text-xs font-bold text-accent-foreground shrink-0">
                    {c.code.slice(-3)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.email} · Joined {dateFmt(c.joined)}
                    </div>
                  </div>

                  {/* Stage progress */}
                  <div className="flex items-center gap-1">
                    {STAGES.slice(0, 4).map((s, i) => {
                      const done = i <= stageIdx;
                      const Icon = s.icon;
                      return (
                        <div
                          key={s.key}
                          className={`h-7 w-7 rounded-full flex items-center justify-center ${done ? "bg-success/20 text-success" : "bg-muted text-muted-foreground/50"}`}
                          title={s.label}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                      );
                    })}
                  </div>

                  <StatusPill
                    tone={
                      c.agreement === "accepted"
                        ? "success"
                        : c.agreement === "viewed"
                          ? "info"
                          : c.agreement === "sent"
                            ? "warning"
                            : "muted"
                    }
                  >
                    Agreement {c.agreement.replace("_", " ")}
                  </StatusPill>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/clinics/${c.id}`}>Review</Link>
                    </Button>
                    <ApproveButton clinicId={c.id} disabled={c.agreement !== "accepted"} />
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </PageBody>
    </>
  );
}
