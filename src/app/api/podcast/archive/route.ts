import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/supabase/server";

const PAID_TIERS = new Set(["launch", "paid", "founder"]);

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const tier = (auth.profile.tier as string | null) ?? "free";
  const isPaid = PAID_TIERS.has(tier);

  const url = req.nextUrl;
  const tierFilter = url.searchParams.get("tier") as "daily" | "themed" | "flagship" | null;
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") ?? "20", 10) || 20, 1),
    100
  );
  const offset = Math.max(parseInt(url.searchParams.get("offset") ?? "0", 10) || 0, 0);

  // Free tier gate: only daily, only last 7 days. Ignore requests for other tiers.
  if (!isPaid && tierFilter && tierFilter !== "daily") {
    return NextResponse.json({ error: "Upgrade required", status: 402 }, { status: 402 });
  }

  const conditions: string[] = [];
  const params: (string | number)[] = [];
  let p = 1;

  if (!isPaid) {
    conditions.push(`tier = 'daily'`);
    conditions.push(`briefing_date >= (NOW() - INTERVAL '7 days')::date`);
  } else if (tierFilter) {
    conditions.push(`tier = $${p++}`);
    params.push(tierFilter);
  }

  // Only global (user_id IS NULL) episodes in archive listing — per-user variants
  // are resolved via /api/podcast (daily) and tier-specific endpoints.
  conditions.push(`user_id IS NULL`);

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  params.push(limit, offset);
  const sql = `
    SELECT id, briefing_date, tier, archetype, theme_slug, flagship_episode_id,
           audio_url, audio_duration_seconds, audio_format, generated_at,
           script->>'title' AS title
    FROM podcast_episodes
    ${where}
    ORDER BY briefing_date DESC, generated_at DESC
    LIMIT $${p++} OFFSET $${p++}
  `;

  try {
    const { rows } = await pool.query(sql, params);
    return NextResponse.json({
      episodes: rows,
      tier,
      paid: isPaid,
      pagination: { limit, offset, returned: rows.length },
    });
  } catch (err) {
    console.error("[podcast/archive] query failed:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
