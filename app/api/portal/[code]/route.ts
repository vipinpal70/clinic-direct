import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, ApiError } from "@/lib/api-utils";
import { isLinkSpent, verifyDetailsToken } from "@/lib/portal-token";

interface Params {
  params: Promise<{ code: string }>;
}

// Public — what the intake page needs to render. Requires the signed link token
// (see lib/portal-token.ts). Never returns bank or tax details: the page only
// collects them. An unknown code and a bad token look the same to the caller.
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { code } = await params;
    const clinic = await prisma.clinic.findUnique({
      where: { code: code.toUpperCase() },
      select: { id: true, name: true, email: true, detailsSubmittedAt: true },
    });
    const issuedAt = clinic && verifyDetailsToken(clinic, req.headers.get("x-portal-token"));
    if (!clinic || !issuedAt) {
      throw new ApiError(404, "This link is invalid or has expired.");
    }

    return NextResponse.json(
      {
        data: {
          name: clinic.name,
          detailsSubmitted: isLinkSpent(issuedAt, clinic.detailsSubmittedAt),
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
