import { NextRequest, NextResponse } from "next/server";
import { findClinicByCode } from "@/lib/clinic-code";
import { requireSession, handleApiError, ApiError } from "@/lib/api-utils";
import { detailsPath } from "@/lib/portal-token";
import { canAccessPath } from "@/lib/roles";

// GET /api/getProfileUrl?code=APX-008
// Returns a signed, expiring link to a clinic's intake page, e.g.
// "/clinic/details/APX-008?t=…". Anyone holding it can submit bank details, so
// it follows the same access rule as the /clinics pages.
// `code` may be the clinic code or the unique code; the URL always uses the latter.
export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    if (!canAccessPath(session.user.role, "/clinics")) {
      throw new ApiError(403, "You do not have permission to perform this action");
    }

    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code")?.trim().toUpperCase();
    if (!code) {
      throw new ApiError(400, "Missing required query parameter: code");
    }

    const clinic = await findClinicByCode(code);
    if (!clinic) {
      throw new ApiError(404, `No clinic found for code: ${code}`);
    }

    return NextResponse.json({
      data: { code: clinic.code, url: detailsPath(clinic) },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
