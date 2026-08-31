import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError, ApiError } from "@/lib/api-utils";

// GET /api/getProfileUrl?code=APX-008
// Returns the relative URL of a clinic's detail page, e.g. "/clinic/details/APX-008".
export async function GET(req: NextRequest) {
  try {
    await requireSession();

    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code")?.trim().toUpperCase();
    if (!code) {
      throw new ApiError(400, "Missing required query parameter: code");
    }

    const clinic = await prisma.clinic.findUnique({
      where: { code },
      select: { code: true },
    });
    if (!clinic) {
      throw new ApiError(404, `No clinic found for code: ${code}`);
    }

    return NextResponse.json({
      data: { code: clinic.code, url: `/clinic/details/${clinic.code}` },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
