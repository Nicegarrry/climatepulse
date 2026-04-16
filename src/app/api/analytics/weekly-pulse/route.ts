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
    const { rows } = await pool.query(
      `SELECT week_start, stories_read, briefings_completed, total_reading_time_seconds,
              sectors_covered, sectors_subscribed, current_streak,
              stories_read_percentile, briefings_completed_percentile,
              cohort_size, cohort_avg_stories
       FROM weekly_user_summaries
       WHERE user_id = $1
       ORDER BY week_start DESC
       LIMIT 1`,
      [userId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ pulse: null });
    }

    return NextResponse.json({ pulse: rows[0] });
  } catch (error) {
    console.error("[weekly-pulse] Error:", error);
    return NextResponse.json({ error: "Failed to fetch weekly pulse" }, { status: 500 });
  }
}
