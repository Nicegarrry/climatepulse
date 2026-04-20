/**
 * POST /api/s/[slug]/cohort-redeem
 *
 * Body: { code: string }
 * Returns the AccessDecision from redeemCohortCode(). On success a viewer
 * membership row is created by the library; the client then reloads the
 * surface page, which re-runs resolveAccess and admits the viewer.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { fetchSurfaceBySlug, redeemCohortCode } from "@/lib/surfaces/access";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;

  let body: { code?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const code = typeof body.code === "string" ? body.code : "";
  if (!code.trim()) {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }

  const surface = await fetchSurfaceBySlug(slug);
  if (!surface) {
    return NextResponse.json(
      { allowed: false, reason: "surface_not_found" },
      { status: 404 },
    );
  }

  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      {
        allowed: false,
        reason: "needs_sign_in",
        requires: "sign_in",
        error: "Sign in required",
      },
      { status: 401 },
    );
  }

  try {
    const decision = await redeemCohortCode(surface.id, code, {
      user_id: user.id,
      email: user.email ?? null,
    });
    const status = decision.allowed ? 200 : 403;
    return NextResponse.json(decision, { status });
  } catch (err) {
    console.error("[api/s/slug/cohort-redeem] redeem failed", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 },
    );
  }
}
