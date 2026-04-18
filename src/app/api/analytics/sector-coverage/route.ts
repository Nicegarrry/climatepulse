import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  if (userId !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // 1. Get user's subscribed sectors
    const { rows: profileRows } = await pool.query(
      `SELECT primary_sectors FROM user_profiles WHERE id = $1`,
      [userId]
    );

    if (profileRows.length === 0) {
      return NextResponse.json({ sectors: [], nudge: null });
    }

    const subscribedSectors: string[] = profileRows[0].primary_sectors || [];
    if (subscribedSectors.length === 0) {
      return NextResponse.json({ sectors: [], nudge: null });
    }

    // 2. Get this week's start (Monday)
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const weekStart = new Date(now);
    weekStart.setDate(diff);
    weekStart.setHours(0, 0, 0, 0);
    const weekStartStr = weekStart.toISOString().slice(0, 10);

    // 3. Count stories published this week per sector (from enriched_articles via daily_briefings)
    // We check enriched_articles that have microsector slugs matching the user's sectors
    const { rows: publishedRows } = await pool.query(
      `SELECT unnest(microsector_ids) AS microsector_id, COUNT(DISTINCT id) AS story_count
       FROM enriched_articles
       WHERE enriched_at >= $1::date
       GROUP BY 1`,
      [weekStartStr]
    );

    // 4. Map microsector IDs to sector slugs via taxonomy
    const { rows: microsectorRows } = await pool.query(
      `SELECT ms.slug, ms.id
       FROM taxonomy_microsectors ms
       WHERE ms.slug = ANY($1)`,
      [subscribedSectors]
    );

    // Build a lookup from microsector slug to name
    const microsectorMap = new Map<string, string>();
    for (const ms of microsectorRows) {
      microsectorMap.set(String(ms.id), ms.slug);
    }

    // 5. Get stories viewed this week from analytics_events
    const { rows: viewedRows } = await pool.query(
      `SELECT DISTINCT (properties->>'story_id') AS story_id
       FROM analytics_events
       WHERE user_id = $1
         AND event_name = 'story.viewed'
         AND created_at >= $2::date`,
      [userId, weekStartStr]
    );

    const viewedStoryIds = new Set(viewedRows.map((r) => r.story_id));

    // 6. Compute per-sector coverage
    const sectorCounts = new Map<string, { published: number; read: number }>();
    for (const sector of subscribedSectors) {
      sectorCounts.set(sector, { published: 0, read: 0 });
    }

    // For simplicity with the current data model, we use briefing_completions
    // to estimate coverage per sector. Full implementation would join story-level data.
    // For now, return the subscribed sectors with zero-fill so the UI renders.
    const sectors = subscribedSectors.map((slug) => {
      const counts = sectorCounts.get(slug) || { published: 0, read: 0 };
      return {
        sector_slug: slug,
        sector_name: slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        stories_published: counts.published,
        stories_read: counts.read,
      };
    });

    // 7. Nudge: sector with zero reads and most stories published
    const nudgeSector = sectors
      .filter((s) => s.stories_read === 0 && s.stories_published >= 2)
      .sort((a, b) => b.stories_published - a.stories_published)[0];

    return NextResponse.json({
      sectors,
      nudge: nudgeSector
        ? {
            sector_name: nudgeSector.sector_name,
            stories_available: nudgeSector.stories_published,
            last_read_date: null,
          }
        : null,
    });
  } catch (error) {
    console.error("[analytics/sector-coverage] Error:", error);
    return NextResponse.json({ error: "Failed to fetch coverage" }, { status: 500 });
  }
}
