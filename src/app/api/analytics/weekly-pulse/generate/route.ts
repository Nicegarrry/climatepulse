import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/supabase/server";

function getLastWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1) - 7; // Previous Monday
  const d = new Date(now);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

function getLastWeekEnd(weekStart: string): string {
  const d = new Date(weekStart + "T00:00:00");
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
    if (!isCron) {
      const auth = await requireAuth("admin");
      if ("error" in auth) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
      }
    }

    const weekStart = getLastWeekStart();
    const weekEnd = getLastWeekEnd(weekStart);

    // Get all active users
    const { rows: users } = await pool.query(
      `SELECT id, primary_sectors FROM user_profiles`
    );

    let generated = 0;

    for (const user of users) {
      const userId = user.id;
      const subscribedSectors: string[] = user.primary_sectors || [];

      // Count briefings completed this week
      const { rows: completionRows } = await pool.query(
        `SELECT COUNT(*) AS cnt, COALESCE(SUM(total_view_time_seconds), 0) AS total_time
         FROM briefing_completions
         WHERE user_id = $1 AND edition_date >= $2 AND edition_date < $3`,
        [userId, weekStart, weekEnd]
      );
      const briefingsCompleted = parseInt(completionRows[0].cnt, 10);
      const totalReadingTime = parseInt(completionRows[0].total_time, 10);

      // Count distinct stories viewed
      const { rows: storyRows } = await pool.query(
        `SELECT COUNT(DISTINCT properties->>'story_id') AS cnt
         FROM analytics_events
         WHERE user_id = $1
           AND event_name = 'story.viewed'
           AND created_at >= $2::date
           AND created_at < $3::date`,
        [userId, weekStart, weekEnd]
      );
      const storiesRead = parseInt(storyRows[0].cnt, 10);

      // Get current streak
      const { rows: streakRows } = await pool.query(
        `SELECT current_streak FROM user_streaks WHERE user_id = $1`,
        [userId]
      );
      const currentStreak = streakRows.length > 0 ? streakRows[0].current_streak : 0;

      // Sectors covered: count distinct sectors from viewed stories
      // (simplified — uses briefings_completed as proxy for now)
      const sectorsCovered = Math.min(briefingsCompleted, subscribedSectors.length);

      // Upsert weekly summary
      await pool.query(
        `INSERT INTO weekly_user_summaries
           (user_id, week_start, stories_read, briefings_completed, total_reading_time_seconds,
            sectors_covered, sectors_subscribed, current_streak)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (user_id, week_start) DO UPDATE SET
           stories_read = EXCLUDED.stories_read,
           briefings_completed = EXCLUDED.briefings_completed,
           total_reading_time_seconds = EXCLUDED.total_reading_time_seconds,
           sectors_covered = EXCLUDED.sectors_covered,
           sectors_subscribed = EXCLUDED.sectors_subscribed,
           current_streak = EXCLUDED.current_streak,
           generated_at = NOW()`,
        [
          userId,
          weekStart,
          storiesRead,
          briefingsCompleted,
          totalReadingTime,
          sectorsCovered,
          subscribedSectors.length,
          currentStreak,
        ]
      );

      generated++;
    }

    return NextResponse.json({
      ok: true,
      generated,
      week_start: weekStart,
    });
  } catch (error) {
    console.error("[weekly-pulse/generate] Error:", error);
    return NextResponse.json({ error: "Failed to generate weekly summaries" }, { status: 500 });
  }
}
