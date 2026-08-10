"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ROLES = ["super_admin", "admin", "finance", "support", "read_only"];
const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  finance: "Finance",
  support: "Support",
  read_only: "Read Only",
};

export function ManageUserMenu({
  userId,
  status,
  isSelf,
}: {
  userId: string;
  status: string;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function patch(body: Record<string, string>) {
    setLoading(true);
    const res = await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (res.ok) router.refresh();
  }

  async function remove() {
    if (!confirm("Remove this user's access? This can't be undone.")) return;
    setLoading(true);
    const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
    setLoading(false);
    if (res.ok) router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={loading}>Manage</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Role</DropdownMenuLabel>
        {ROLES.map((r) => (
          <DropdownMenuItem key={r} onClick={() => patch({ role: r })}>
            {ROLE_LABEL[r]}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        {status === "suspended" ? (
          <DropdownMenuItem onClick={() => patch({ status: "active" })}>
            Reactivate account
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            disabled={isSelf}
            onClick={() => patch({ status: "suspended" })}
          >
            Suspend account
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          disabled={isSelf}
          onClick={remove}
        >
          Remove user
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
