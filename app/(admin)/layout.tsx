import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/session";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { SessionWatcher } from "@/components/session-watcher";
import { TooltipProvider } from "@/components/ui/tooltip";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionFromCookies();
  if (!session?.user) redirect("/login");

  return (
    <TooltipProvider>
      <SessionWatcher />
      <div className="flex min-h-screen bg-background">
        <Sidebar user={session.user} />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar />
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
