import { Shield } from "lucide-react";
import { getSessionFromCookies } from "@/lib/session";
import { PageHeader, PageBody } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusPill } from "@/components/shared/status-pill";
import { prisma } from "@/lib/prisma";
import { initials, relativeTime } from "@/lib/utils";
import { InviteUserDialog } from "./invite-user-dialog";
import { ManageUserMenu } from "./manage-user-menu";

export const metadata = { title: "Users & roles" };
export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Admin",
  admin: "Admin",
  finance: "Finance",
  support: "Support",
  read_only: "Read Only",
};

const ROLE_TONE: Record<string, "info" | "success" | "warning" | "muted"> = {
  super_admin: "info",
  admin: "info",
  finance: "warning",
  support: "success",
  read_only: "muted",
};

export default async function UsersPage() {
  const [session, adminUsers] = await Promise.all([
    getSessionFromCookies(),
    prisma.adminUser.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <>
      <PageHeader
        title="Users & roles"
        description="All platform users. Role is a label — every account has full access."
        actions={<InviteUserDialog />}
      />
      <PageBody>
        <SectionCard
          title="Platform users"
          description={`${adminUsers.length} accounts`}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="font-medium px-5 py-2.5">User</th>
                  <th className="font-medium py-2.5">Role tag</th>
                  <th className="font-medium py-2.5">2FA</th>
                  <th className="font-medium py-2.5">Status</th>
                  <th className="font-medium py-2.5">Last active</th>
                  <th className="py-2.5 pr-5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {adminUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/40 transition-colors">
                    {/* Avatar + name/email */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                          {initials(u.name)}
                        </div>
                        <div>
                          <div className="font-medium">{u.name}</div>
                          <div className="text-xs text-muted-foreground">{u.email}</div>
                        </div>
                      </div>
                    </td>

                    {/* Role — just a label */}
                    <td className="py-3">
                      <StatusPill tone={ROLE_TONE[u.role] ?? "muted"}>
                        {ROLE_LABEL[u.role] ?? u.role}
                      </StatusPill>
                    </td>

                    {/* 2FA */}
                    <td className="py-3">
                      {u.twoFaEnabled ? (
                        <span className="flex items-center gap-1 text-xs text-success">
                          <Shield className="h-3.5 w-3.5" /> On
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Off</span>
                      )}
                    </td>

                    {/* Account status */}
                    <td className="py-3">
                      <StatusPill
                        tone={
                          u.status === "active"
                            ? "success"
                            : u.status === "invited"
                              ? "info"
                              : "muted"
                        }
                      >
                        {u.status}
                      </StatusPill>
                    </td>

                    {/* Last active */}
                    <td className="py-3 text-xs text-muted-foreground tabular-nums">
                      {u.lastLoginAt ? relativeTime(u.lastLoginAt) : "Never"}
                    </td>

                    {/* Actions */}
                    <td className="py-3 pr-5 text-right">
                      <ManageUserMenu
                        userId={u.id}
                        status={u.status}
                        isSelf={u.id === session?.user.id}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </PageBody>
    </>
  );
}
