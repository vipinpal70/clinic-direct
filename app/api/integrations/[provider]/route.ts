import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-utils";
import { logAudit, ipFromRequest } from "@/lib/audit";

const updateSchema = z.object({
  active: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

const SENSITIVE_KEY = /key|secret|token|hash/i;

function maskConfig(config: unknown): Record<string, unknown> {
  if (!config || typeof config !== "object") return {};
  const entries = Object.entries(config as Record<string, unknown>).map(
    ([key, value]) => {
      if (typeof value === "string" && SENSITIVE_KEY.test(key)) {
        return [key, value.length > 4 ? `••••••••${value.slice(-4)}` : "••••••••"];
      }
      return [key, value];
    },
  );
  return Object.fromEntries(entries);
}

interface Params {
  params: Promise<{ provider: string }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireSession();
    const { provider } = await params;
    const config = await prisma.integrationConfig.findUnique({ where: { provider } });
    if (!config) {
      return NextResponse.json({ data: null });
    }
    return NextResponse.json({
      data: { ...config, config: maskConfig(config.config) },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await requireSession();
    const { provider } = await params;
    const input = updateSchema.parse(await req.json());

    const existing = await prisma.integrationConfig.findUnique({ where: { provider } });
    const mergedConfig = {
      ...(existing?.config && typeof existing.config === "object" ? existing.config : {}),
      ...(input.config ?? {}),
    } as Prisma.InputJsonValue;

    const config = await prisma.integrationConfig.upsert({
      where: { provider },
      create: {
        provider,
        active: input.active ?? true,
        config: mergedConfig,
      },
      update: {
        active: input.active,
        config: mergedConfig,
      },
    });

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email ?? "unknown",
      action: "integration.config.updated",
      target: provider,
      ipAddress: ipFromRequest(req),
    });

    return NextResponse.json({
      data: { ...config, config: maskConfig(config.config) },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
