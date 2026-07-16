import { Shield, Key, Clock, Mail } from "lucide-react";
import { PageHeader, PageBody } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { auditLog } from "@/lib/mock";
import { relativeTime } from "@/lib/utils";

export const metadata = { title: "My profile" };

const MY_LOGS = auditLog.filter(
  (l) => l.userEmail === "priya@clinicdirect.co.uk",
);

const EMAIL_NOTIFICATIONS = [
  { key: "clinic_approved", label: "Clinic approved", description: "When a clinic is approved by an admin" },
  { key: "new_approval", label: "New clinic awaiting approval", description: "When a clinic accepts the agreement" },
  { key: "invoice_generated", label: "Invoice generated", description: "When a self-billed invoice is created" },
  { key: "invoice_pushed", label: "Invoice pushed to Orderwise", description: "Confirmation after a push succeeds" },
  { key: "webhook_failed", label: "Webhook failure", description: "When a Shopify webhook fails after retries" },
  { key: "commission_run", label: "Commission run completed", description: "Monthly commission calculation summary" },
  { key: "user_invited", label: "New user invited", description: "When a team member is added" },
];

export default function ProfilePage() {
  return (
    <>
      <PageHeader
        title="My profile"
        description="Account settings, security and email notification preferences."
      />
      <PageBody>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Profile card */}
          <SectionCard className="lg:col-span-1">
            <div className="p-6 flex flex-col items-center text-center gap-4">
              <div className="h-20 w-20 rounded-full bg-primary flex items-center justify-center text-2xl font-bold text-primary-foreground font-display">
                PS
              </div>
              <div>
                <div className="font-semibold text-lg">Priya Sharma</div>
                <div className="text-sm text-muted-foreground">
                  priya@clinicdirect.co.uk
                </div>
              </div>
              <StatusPill tone="info">Super Admin</StatusPill>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Active 2 minutes ago
              </div>
              <Button variant="outline" size="sm" className="w-full">
                Edit profile
              </Button>
            </div>
          </SectionCard>

          {/* Account details + security */}
          <div className="lg:col-span-2 space-y-4">
            <SectionCard title="Account details">
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FieldInput label="Full name" value="Priya Sharma" />
                <FieldInput label="Email" value="priya@clinicdirect.co.uk" />
                <FieldInput label="Job title" value="Operations Manager" />
              </div>
            </SectionCard>

            <SectionCard
              title="Security"
              actions={
                <StatusPill tone="success">
                  <Shield className="h-3 w-3" />
                  2FA enabled
                </StatusPill>
              }
            >
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
                  <div className="flex items-center gap-2 text-sm">
                    <Shield className="h-4 w-4 text-success" />
                    <div>
                      <div className="font-medium">Two-factor authentication</div>
                      <div className="text-xs text-muted-foreground">
                        Authenticator app enabled
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">Manage</Button>
                </div>

                <div>
                  <div className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Key className="h-4 w-4 text-muted-foreground" />
                    Change password
                  </div>
                  <div className="space-y-3 max-w-sm">
                    <FieldInput label="Current password" value="" type="password" />
                    <FieldInput label="New password" value="" type="password" />
                    <FieldInput label="Confirm new password" value="" type="password" />
                    <Button size="sm">Update password</Button>
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>

        {/* Email notifications — email only */}
        <SectionCard
          title="Email notifications"
          description="Choose which events trigger an email to your inbox. All notifications are email-only."
        >
          <div className="divide-y divide-border">
            <div className="flex items-center gap-3 px-5 py-3 bg-muted/30">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground">
                Notifications are sent to <strong>priya@clinicdirect.co.uk</strong>
              </span>
            </div>
            {EMAIL_NOTIFICATIONS.map((n) => (
              <div key={n.key} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors">
                <div>
                  <div className="text-sm font-medium">{n.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{n.description}</div>
                </div>
                {/* Toggle — using a styled checkbox as a visually clean toggle */}
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-border rounded-full peer peer-checked:bg-primary peer-focus:ring-2 peer-focus:ring-ring/40 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                </label>
              </div>
            ))}
          </div>
          <div className="px-5 py-4 border-t border-border flex justify-end">
            <Button size="sm">Save preferences</Button>
          </div>
        </SectionCard>

        {/* Recent activity */}
        <SectionCard
          title="My recent activity"
          description="Actions you've taken in this platform"
        >
          {MY_LOGS.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No recent activity recorded.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="font-medium px-5 py-2.5">Time</th>
                    <th className="font-medium py-2.5">Action</th>
                    <th className="font-medium py-2.5">Target</th>
                    <th className="font-medium py-2.5 pr-5">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {MY_LOGS.map((l) => (
                    <tr key={l.id} className="hover:bg-muted/40">
                      <td className="px-5 py-2.5 text-muted-foreground text-xs">
                        {relativeTime(l.time)}
                      </td>
                      <td className="py-2.5 font-mono text-xs">{l.action}</td>
                      <td className="py-2.5 text-sm">{l.target}</td>
                      <td className="py-2.5 pr-5 font-mono text-xs text-muted-foreground">
                        {l.ip}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </PageBody>
    </>
  );
}

function FieldInput({
  label,
  value,
  type = "text",
}: {
  label: string;
  value: string;
  type?: string;
}) {
  return (
    <label className="block">
      <div className="text-xs text-muted-foreground mb-1.5">{label}</div>
      <input
        type={type}
        defaultValue={value}
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
      />
    </label>
  );
}
