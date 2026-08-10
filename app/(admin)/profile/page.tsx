import { redirect } from "next/navigation";
import { Key, Clock } from "lucide-react";
import { getSessionFromCookies } from "@/lib/session";
import { PageHeader, PageBody } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusPill } from "@/components/shared/status-pill";
import { prisma } from "@/lib/prisma";
import { initials, relativeTime } from "@/lib/utils";
import { ProfileForm } from "./profile-form";
import { PasswordForm } from "./password-form";

export const metadata = { title: "My profile" };
export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  finance: "Finance",
  support: "Support",
  read_only: "Read Only",
};

export default async function ProfilePage() {
  const session = await getSessionFromCookies();
  if (!session?.user) redirect("/login");

  const user = await prisma.adminUser.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");

  return (
    <>
      <PageHeader
        title="My profile"
        description="Account settings and security."
      />
      <PageBody>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Profile card */}
          <SectionCard className="lg:col-span-1">
            <div className="p-6 flex flex-col items-center text-center gap-4">
              <div className="h-20 w-20 rounded-full bg-primary flex items-center justify-center text-2xl font-bold text-primary-foreground font-display">
                {initials(user.name)}
              </div>
              <div>
                <div className="font-semibold text-lg">{user.name}</div>
                <div className="text-sm text-muted-foreground">{user.email}</div>
              </div>
              <StatusPill tone="info">{ROLE_LABEL[user.role] ?? user.role}</StatusPill>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {user.lastLoginAt ? `Active ${relativeTime(user.lastLoginAt)}` : "No previous logins"}
              </div>
            </div>
          </SectionCard>

          {/* Account details + security */}
          <div className="lg:col-span-2 space-y-4">
            <SectionCard title="Account details">
              <ProfileForm name={user.name} email={user.email} />
            </SectionCard>

            <SectionCard title="Security">
              <div className="p-5 space-y-4">
                <div>
                  <div className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Key className="h-4 w-4 text-muted-foreground" />
                    Change password
                  </div>
                  <PasswordForm />
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      </PageBody>
    </>
  );
}
