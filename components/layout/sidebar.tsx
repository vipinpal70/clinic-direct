"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
	LayoutDashboard,
	Building2,
	ClipboardCheck,
	ShoppingBag,
	Percent,
	FileText,
	Users,
	Store,
	Database,
	MonitorDot,
	ChevronDown,
	LogOut,
	User,
} from "lucide-react";
import { cn, initials } from "@/lib/utils";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ROLE_LABEL: Record<string, string> = {
	super_admin: "Super Admin",
	admin: "Admin",
	finance: "Finance",
	support: "Support",
	read_only: "Read Only",
};

const NAV = [
	{
		section: "Overview",
		items: [{ label: "Dashboard", to: "/", icon: LayoutDashboard }],
	},
	{
		section: "Operations",
		items: [
			{ label: "Clinics", to: "/clinics", icon: Building2 },
			{ label: "Approvals", to: "/approvals", icon: ClipboardCheck },
			{ label: "Orders", to: "/orders", icon: ShoppingBag },
		],
	},
	{
		section: "Finance",
		items: [
			{ label: "Commission", to: "/commission", icon: Percent },
			{ label: "Self-billed invoices", to: "/invoices", icon: FileText },
		],
	},
	// {
	//   section: "Integrations",
	//   items: [
	//     { label: "Shopify", to: "/integrations/shopify", icon: Store },
	//     { label: "Database", to: "/integrations/database", icon: Database },
	//     { label: "Clarity", to: "/integrations/clarity", icon: MonitorDot },
	//   ],
	// },
	{
		section: "System",
		items: [{ label: "Users", to: "/users", icon: Users }],
	},
];

interface SidebarProps {
	user: {
		name?: string | null;
		email?: string | null;
		role?: string;
	};
}

export function Sidebar({ user }: SidebarProps) {
	const pathname = usePathname();
	const displayName = user.name ?? user.email ?? "Admin";

	return (
		<aside className="hidden lg:flex w-64 flex-col border-r border-sidebar-border bg-sidebar flex-shrink-0 h-screen sticky top-0">
			{/* Logo */}
			<div className="flex items-center gap-2.5 px-5 h-16 border-b border-sidebar-border flex-shrink-0">
				<div className="h-8 w-8 rounded-lg bg-white/15 text-white flex items-center justify-center text-sm font-bold font-display">
					CD
				</div>
				<div className="flex flex-col leading-tight">
					<span className="text-sm font-semibold text-sidebar-foreground font-display">
						Clinic Direct
					</span>
					<span className="text-[11px] text-sidebar-muted-foreground">
						Admin platform
					</span>
				</div>
			</div>

			{/* Nav — no scroll, fixed */}
			<nav className="flex-1 py-3 px-3 space-y-4 min-h-0">
				{NAV.map((group) => (
					<div key={group.section}>
						<div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted-foreground">
							{group.section}
						</div>
						<div className="space-y-0.5">
							{group.items.map((item) => {
								const active =
									item.to === "/"
										? pathname === "/"
										: pathname === item.to ||
											pathname.startsWith(item.to + "/");
								const Icon = item.icon;
								return (
									<Link
										key={item.to}
										href={item.to}
										className={cn(
											"group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
											active
												? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
												: "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
										)}
									>
										<Icon
											className={cn(
												"h-4 w-4 shrink-0",
												active
													? "text-sidebar-foreground"
													: "text-sidebar-muted-foreground group-hover:text-sidebar-foreground",
											)}
										/>
										<span>{item.label}</span>
									</Link>
								);
							})}
						</div>
					</div>
				))}
			</nav>

			{/* User footer */}
			<div className="border-t border-sidebar-border p-3 flex-shrink-0">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button className="w-full flex items-center gap-2.5 rounded-md px-2 py-2 hover:bg-sidebar-accent/50 transition-colors cursor-pointer">
							<div className="h-8 w-8 rounded-full bg-white/15 flex items-center justify-center text-xs font-semibold text-white">
								{initials(displayName)}
							</div>
							<div className="flex-1 min-w-0 text-left">
								<div className="text-sm font-medium text-sidebar-foreground truncate">
									{displayName}
								</div>
								<div className="text-[11px] text-sidebar-muted-foreground truncate">
									{ROLE_LABEL[user.role ?? ""] ?? "Admin"}
								</div>
							</div>
							<ChevronDown className="h-4 w-4 text-sidebar-muted-foreground shrink-0" />
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" side="top" className="w-56 mb-1">
						<DropdownMenuLabel>My account</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<DropdownMenuItem asChild>
							<Link href="/profile">
								<User className="h-4 w-4" />
								Profile
							</Link>
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							className="text-destructive focus:text-destructive"
							onClick={async () => {
								await fetch("/api/auth/logout", { method: "POST" });
								localStorage.clear();
								sessionStorage.clear();
								window.location.href = "/login";
							}}
						>
							<LogOut className="h-4 w-4" />
							Sign out
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</aside>
	);
}
