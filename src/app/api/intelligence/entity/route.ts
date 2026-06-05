import { NextRequest, NextResponse } from "next/server";
import { getEntityBrief } from "@/lib/intelligence/retriever";
import { requireAuth } from "@/lib/supabase/server";
import { rateLimitOr429 } from "@/lib/surfaces/rate-limit";

export async function GET(req: NextRequest) {
  // Gate: enumerable ?id= scraping + heavy per-entity SQL. Login-only + throttle.
  const auth = await requireAuth();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const limited = rateLimitOr429({ surfaceId: "intelligence-entity", key: auth.user.id, limit: 40, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const entityId = parseInt(req.nextUrl.searchParams.get("id") ?? "");

    if (isNaN(entityId)) {
      return NextResponse.json({ error: "id parameter is required (integer)" }, { status: 400 });
    }

    const brief = await getEntityBrief(entityId);

    if (!brief) {
      return NextResponse.json({ error: "Entity not found" }, { status: 404 });
    }

    return NextResponse.json({
      entity: brief.entity,
      recent_content: brief.recent_content.map((item) => ({
        content_type: item.content_type,
        source_id: item.source_id,
        title: item.title,
        subtitle: item.subtitle,
        url: item.url,
        published_at: item.published_at,
        primary_domain: item.primary_domain,
        signal_type: item.signal_type,
        significance_composite: item.significance_composite,
        sentiment: item.sentiment,
      })),
      domain_distribution: brief.domain_distribution,
      signal_distribution: brief.signal_distribution,
      significance_trend: brief.significance_trend,
      related_entities: brief.related_entities,
    });
  } catch (err) {
    console.error("Entity brief error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate entity brief" },
      { status: 500 }
    );
  }
}
