import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
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
