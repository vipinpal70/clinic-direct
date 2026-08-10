"use client";

import { Search, Command, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TopBar() {
  return (
    <header className="sticky top-0 z-20 h-16 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="h-full flex items-center gap-4 px-6">
        {/* Mobile hamburger */}
        <Button variant="ghost" size="icon" className="lg:hidden -ml-2">
          <Menu className="h-5 w-5" />
        </Button>

        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            placeholder="Search clinics, orders, invoices…"
            className="h-9 w-full rounded-md border border-input bg-card pl-9 pr-16 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 transition-shadow"
          />
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden md:inline-flex items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground pointer-events-none">
            <Command className="h-3 w-3" />K
          </kbd>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {/* System status pill */}
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-border bg-card pl-2.5 pr-3 py-1">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
            <span className="text-xs text-muted-foreground">All systems normal</span>
          </div>

          {/* Notifications */}
          {/* <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-4 w-4" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive" />
          </Button> */}
        </div>
      </div>
    </header>
  );
}
