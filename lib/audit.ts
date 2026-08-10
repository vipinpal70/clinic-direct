import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function logAudit(entry: {
  userId?: string | null;
  userEmail: string;
  action: string;
  target: string;
  prevValue?: string | null;
  newValue?: string | null;
  ipAddress?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      userId: entry.userId ?? undefined,
      userEmail: entry.userEmail,
      action: entry.action,
      target: entry.target,
      prevValue: entry.prevValue ?? undefined,
      newValue: entry.newValue ?? undefined,
      ipAddress: entry.ipAddress ?? undefined,
      metadata: entry.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}

export function ipFromRequest(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}
