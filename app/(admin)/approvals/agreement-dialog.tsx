"use client";

import { useState } from "react";
import { FileSignature } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AgreementPanel } from "@/app/(admin)/clinics/[id]/agreement-panel";

interface Props {
  clinicId: string;
  clinicName: string;
  code: string;
  detailsPath: string;
  agreement: string;
  commissionPct: number;
  agreementCommissionPct: number | null;
  agreementExpiry: string | null;
  agreementLocked: boolean;
  agreementSignedName: string | null;
  detailsSubmitted: boolean;
  emailSentCount: number;
  emailSentAt: string | null;
}

export function AgreementDialog(props: Props) {
  const [open, setOpen] = useState(false);
  const label = props.agreement === "not_sent" ? "Send agreement" : "Edit agreement";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileSignature className="h-4 w-4" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle>{props.clinicName}</DialogTitle>
          <DialogDescription>
            Collect details and manage this clinic&apos;s partnership agreement.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto">
          <AgreementPanel
            clinicId={props.clinicId}
            code={props.code}
            detailsPath={props.detailsPath}
            agreement={props.agreement}
            commissionPct={props.commissionPct}
            agreementCommissionPct={props.agreementCommissionPct}
            agreementExpiry={props.agreementExpiry}
            agreementLocked={props.agreementLocked}
            agreementSignedName={props.agreementSignedName}
            detailsSubmitted={props.detailsSubmitted}
            emailSentCount={props.emailSentCount}
            emailSentAt={props.emailSentAt}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
