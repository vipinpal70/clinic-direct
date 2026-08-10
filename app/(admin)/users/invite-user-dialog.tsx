"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";

const ROLES = [
	{ value: "admin", label: "Admin" },
	{ value: "finance", label: "Finance" },
	{ value: "support", label: "Support" },
	{ value: "read_only", label: "Read Only" },
];

export function InviteUserDialog() {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [tempPassword, setTempPassword] = useState<string | null>(null);
	const [form, setForm] = useState({ name: "", email: "", role: "support" });

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setLoading(true);
		setError(null);

		const res = await fetch("/api/users", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(form),
		});

		setLoading(false);
		const body = await res.json().catch(() => null);

		if (!res.ok) {
			setError(body?.error ?? "Failed to add user");
			return;
		}

		setTempPassword(body.tempPassword);
		router.refresh();
	}

	function close() {
		setOpen(false);
		setTempPassword(null);
		setForm({ name: "", email: "", role: "support" });
	}

	return (
		<Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
			<Button size="sm" onClick={() => setOpen(true)}>
				<Plus className="h-4 w-4" />
				Add user
			</Button>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Add user</DialogTitle>
					<DialogDescription>
						They&apos;ll be created with a temporary password — share it
						securely.
					</DialogDescription>
				</DialogHeader>

				{tempPassword ? (
					<div className="space-y-4">
						<div className="rounded-md border border-border bg-muted/40 p-4 text-sm">
							<p className="text-muted-foreground mb-2">
								Account created. Temporary password (shown once):
							</p>
							<code className="font-mono text-sm font-semibold">
								{tempPassword}
							</code>
						</div>
						<DialogFooter>
							<Button onClick={close}>Done</Button>
						</DialogFooter>
					</div>
				) : (
					<form className="space-y-4" onSubmit={onSubmit}>
						{error && (
							<div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
								{error}
							</div>
						)}
						<div>
							<Label className="text-xs">Full name</Label>
							<Input
								className="mt-1.5"
								value={form.name}
								onChange={(e) =>
									setForm((f) => ({ ...f, name: e.target.value }))
								}
								required
							/>
						</div>
						<div>
							<Label className="text-xs">Email</Label>
							<Input
								type="email"
								className="mt-1.5"
								value={form.email}
								onChange={(e) =>
									setForm((f) => ({ ...f, email: e.target.value }))
								}
								required
							/>
						</div>
						<div>
							<Label className="text-xs">Role</Label>
							<select
								className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
								value={form.role}
								onChange={(e) =>
									setForm((f) => ({ ...f, role: e.target.value }))
								}
							>
								{ROLES.map((r) => (
									<option key={r.value} value={r.value}>
										{r.label}
									</option>
								))}
							</select>
						</div>
						<DialogFooter>
							<Button type="submit" disabled={loading}>
								{loading ? "Inviting…" : "Send invite"}
							</Button>
						</DialogFooter>
					</form>
				)}
			</DialogContent>
		</Dialog>
	);
}
