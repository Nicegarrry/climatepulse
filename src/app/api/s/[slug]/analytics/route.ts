/**
 * POST /api/s/:slug/analytics — record a surface engagement event.
 *
 * Body: { metric, value?, metadata? }
 *
 * Validates that the surface exists + is visible to the caller (via
 * resolveAccess), then applies a per-IP sliding-window rate limit (60
 * req/min default) to mitigate bot traffic on the public /s/[slug] surface.
 *
 * Audit rows (metric='export' with metadata.audit=true) are NOT accepted
 * from this endpoint — those come from the access / delete flows directly.
 */
import { NextResponse, type NextRequest } from "next/server";
import { fetchSurfaceBySlug, resolveAccess } from "@/lib/surfaces/access";
import { getAuthUser } from "@/lib/supabase/server";
import pool from "@/lib/db";
import { recordEvent } from "@/lib/surfaces/analytics";
import { withSurfaceRateLimit } from "@/lib/surfaces/rate-limit";
import type { AnalyticsMetric } from "@/lib/surfaces/types";

const ACCEPTED_METRICS: ReadonlyArray<AnalyticsMetric> = [
  "view",
  "path_start",
  "path_complete",
  "item_complete",
  "quiz_score",
  "search",
  // 'export' intentionally excluded — reserved for audit rows.
];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const surface = await fetchSurfaceBySlug(slug);
  if (!surface) {
    return NextResponse.json({ error: "Surface not found" }, { status: 404 });
  }

  // Resolve viewer. This endpoint is callable by anonymous viewers when the
  // surface is public/unlisted — resolveAccess handles the decision.
  const user = await getAuthUser();
  let viewerEmail: string | null = null;
  if (user) {
    try {
      const { rows } = await pool.query<{ email: string | null }>(
        `SELECT email FROM user_profiles WHERE id = $1`,
        [user.id],
      );
      viewerEmail = rows[0]?.email ?? null;
    } catch {
      viewerEmail = null;
    }
  }

  const decision = await resolveAccess(surface, {
    user_id: user?.id ?? null,
    email: viewerEmail,
  });
  if (!decision.allowed) {
    const status =
      decision.reason === "needs_sign_in"
        ? 401
        : decision.reason === "surface_not_found" || decision.reason === "archived"
        ? 404
        : 403;
    return NextResponse.json(
      { error: decision.reason, requires: decision.requires ?? null },
      { status },
    );
  }

  return withSurfaceRateLimit(req, surface.id, async () => {
    let body: {
      metric?: string;
      value?: number | null;
      metadata?: Record<string, unknown>;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const metric = body.metric as AnalyticsMetric | undefined;
    if (!metric || !ACCEPTED_METRICS.includes(metric)) {
      return NextResponse.json(
        {
          error: "invalid metric",
          allowed: ACCEPTED_METRICS,
        },
        { status: 400 },
      );
    }

    // Sanitise metadata — clients cannot forge audit rows.
    const metadata = { ...(body.metadata ?? {}) };
    if ("audit" in metadata) delete metadata.audit;

    await recordEvent({
      surfaceId: surface.id,
      metric,
      userId: user?.id ?? null,
      value: typeof body.value === "number" ? body.value : null,
      metadata,
    });

    return NextResponse.json({ ok: true });
  });
}

export const runtime = "nodejs";
