import { prisma } from "@/lib/prisma";

const COLLECTIONS = [
  "clinics",
  "orders",
  "commissions",
  "invoices",
  "commission_rules",
  "admin_users",
  "audit_logs",
  "webhook_logs",
] as const;

interface CollStats {
  size?: number;
  count?: number;
  nindexes?: number;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function getDatabaseStats() {
  let healthy = true;
  try {
    await prisma.$runCommandRaw({ ping: 1 });
  } catch {
    healthy = false;
  }

  const collections = await Promise.all(
    COLLECTIONS.map(async (name) => {
      try {
        const stats = (await prisma.$runCommandRaw({ collStats: name })) as CollStats;
        return {
          name,
          documents: stats.count ?? 0,
          size: formatBytes(stats.size ?? 0),
          indexes: stats.nindexes ?? 0,
        };
      } catch {
        return { name, documents: 0, size: "—", indexes: 0 };
      }
    }),
  );

  return {
    healthy,
    collections,
    totalDocuments: collections.reduce((a, c) => a + c.documents, 0),
  };
}
