import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getAuthUser } from "@/lib/supabase/server";
import { fetchFeed } from "@/lib/newsroom/feed-queries";
import { expandToMicrosectorSlugs } from "@/lib/expand-sectors";
import { getDomainSlugs } from "@/lib/enrichment/taxonomy-cache";

const DEFAULT_LIMIT = 60;
const DEFAULT_THRESHOLD = 3;

interface UserPrefRow {
  primary_sectors: string[] | null;
  notification_prefs: { newsroom_threshold?: number } | null;
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const sectorsParam = url.searchParams.get("sectors");
  const thresholdParam = url.searchParams.get("threshold");
  const cursor = url.searchParams.get("cursor");
  const limitParam = Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(limitParam) ? limitParam : DEFAULT_LIMIT;

  // Anonymous users see a bare-bones feed (no save state, no personalisation).
  // Signed-in users get their saved-state markers and pref-driven defaults.
  const user = await getAuthUser();
  let userId: string | null = null;
  let threshold = DEFAULT_THRESHOLD;
  let userSectors: string[] = [];

  if (user) {
    userId = user.id;
    const { rows } = await pool.query<UserPrefRow>(
      `SELECT primary_sectors, notification_prefs FROM user_profiles WHERE id = $1`,
      [user.id]
    );
    if (rows.length > 0) {
      userSectors = Array.isArray(rows[0].primary_sectors)
        ? rows[0].primary_sectors
        : [];
      const prefThreshold = Number(rows[0].notification_prefs?.newsroom_threshold);
      if (Number.isFinite(prefThreshold) && prefThreshold >= 1 && prefThreshold <= 5) {
        threshold = prefThreshold;
      }
    }
  }

  // URL params override stored prefs.
  if (thresholdParam) {
    const t = Number(thresholdParam);
    if (Number.isFinite(t) && t >= 1 && t <= 5) threshold = t;
  }

  // Sector filter resolution: explicit URL > user pref > all
  let sectorSlugs: string[] = [];
  if (sectorsParam !== null) {
    sectorSlugs = sectorsParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  } else if (userSectors.length > 0) {
    sectorSlugs = userSectors;
  }

  // The Newsroom tags items at domain level (one of the 12 domain slugs).
  // user.primary_sectors may contain microsector slugs — we resolve any
  // microsector slug to its parent domain by intersecting against the
  // 12 domain slug list, falling back to expansion when needed.
  if (sectorSlugs.length > 0) {
    const domains = await getDomainSlugs();
    const matchedDomains = sectorSlugs.filter((s) => domains.has(s));
    if (matchedDomains.length === 0) {
      // None of the user's selections are domain slugs — treat as a no-op
      // filter (show everything) rather than show an empty feed.
      sectorSlugs = [];
    } else {
      // If the user picked a mix, the domain-level slugs win — drop the
      // microsectors. (Newsroom doesn't classify microsectors.)
      sectorSlugs = matchedDomains;
    }
    // Suppress lint on the unused expand import — kept for future microsector
    // → domain mapping when the taxonomy layer exposes a parent lookup.
    void expandToMicrosectorSlugs;
  }

  try {
    const items = await fetchFeed({
      userId,
      threshold,
      sectorSlugs,
      cursor,
      limit,
    });

    const nextCursor =
      items.length === limit ? items[items.length - 1].published_at : null;

    return NextResponse.json({
      items,
      cursor: nextCursor,
      threshold,
      sectors: sectorSlugs,
    });
  } catch (err) {
    console.error("[newsroom/feed] error:", err);
    return NextResponse.json(
      { error: "feed query failed", message: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
