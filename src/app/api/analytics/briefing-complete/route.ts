import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

function subtractDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function getISOWeekStart(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, editionDate, storiesViewed, totalStories, totalViewTimeSeconds } = body as {
      userId: string;
      editionDate: string;
      storiesViewed: number;
      totalStories: number;
      totalViewTimeSeconds: number;
    };

    if (!userId || !editionDate) {
      return NextResponse.json({ error: "userId and editionDate required" }, { status: 400 });
    }

    // 1. Insert completion (upsert — idempotent)
    await pool.query(
      `INSERT INTO briefing_completions (user_id, edition_date, stories_viewed, stories_total, total_view_time_seconds)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, edition_date) DO UPDATE SET
         stories_viewed = EXCLUDED.stories_viewed,
         stories_total = EXCLUDED.stories_total,
         total_view_time_seconds = EXCLUDED.total_view_time_seconds,
         completed_at = NOW()`,
      [userId, editionDate, storiesViewed, totalStories, totalViewTimeSeconds]
    );

    // 2. Fetch current streak
    const { rows: streakRows } = await pool.query(
      `SELECT * FROM user_streaks WHERE user_id = $1`,
      [userId]
    );

    const today = editionDate;
    const yesterday = subtractDays(today, 1);
    const dayBeforeYesterday = subtractDays(today, 2);
    const currentWeekStart = getISOWeekStart(today);

    let newStreak: number;
    let longestStreak: number;
    let streakStartedDate: string;
    let graceDaysUsed: number;
    let graceWeekStart: string;
    let isNewRecord = false;

    if (streakRows.length === 0) {
      // First ever completion
      newStreak = 1;
      longestStreak = 1;
      streakStartedDate = today;
      graceDaysUsed = 0;
      graceWeekStart = currentWeekStart;

      await pool.query(
        `INSERT INTO user_streaks (user_id, current_streak, longest_streak, last_completed_date, streak_started_date, grace_days_used_this_week, grace_week_start)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, newStreak, longestStreak, today, streakStartedDate, graceDaysUsed, graceWeekStart]
      );
    } else {
      const streak = streakRows[0];
      const lastDate = streak.last_completed_date
        ? new Date(streak.last_completed_date).toISOString().slice(0, 10)
        : null;

      if (lastDate === today) {
        // Already completed today — return current streak
        return NextResponse.json({
          streak: streak.current_streak,
          longest_streak: streak.longest_streak,
          is_new_record: false,
        });
      }

      // Reset grace counter if we're in a new week
      graceDaysUsed = streak.grace_days_used_this_week || 0;
      graceWeekStart = streak.grace_week_start
        ? new Date(streak.grace_week_start).toISOString().slice(0, 10)
        : currentWeekStart;
      if (graceWeekStart !== currentWeekStart) {
        graceDaysUsed = 0;
        graceWeekStart = currentWeekStart;
      }

      if (lastDate === yesterday) {
        // Continuing streak — consecutive day
        newStreak = streak.current_streak + 1;
        streakStartedDate = streak.streak_started_date
          ? new Date(streak.streak_started_date).toISOString().slice(0, 10)
          : today;
      } else if (lastDate === dayBeforeYesterday && graceDaysUsed < 1) {
        // Grace day — missed exactly one day, allowed once per week
        newStreak = streak.current_streak + 1;
        graceDaysUsed += 1;
        streakStartedDate = streak.streak_started_date
          ? new Date(streak.streak_started_date).toISOString().slice(0, 10)
          : today;
      } else {
        // Streak broken — start fresh
        newStreak = 1;
        streakStartedDate = today;
      }

      longestStreak = Math.max(newStreak, streak.longest_streak);
      isNewRecord = newStreak > streak.longest_streak;

      await pool.query(
        `UPDATE user_streaks SET
           current_streak = $2,
           longest_streak = $3,
           last_completed_date = $4,
           streak_started_date = $5,
           grace_days_used_this_week = $6,
           grace_week_start = $7,
           updated_at = NOW()
         WHERE user_id = $1`,
        [userId, newStreak, longestStreak, today, streakStartedDate, graceDaysUsed, graceWeekStart]
      );
    }

    return NextResponse.json({
      streak: newStreak,
      longest_streak: longestStreak,
      is_new_record: isNewRecord,
    });
  } catch (error) {
    console.error("[analytics/briefing-complete] Error:", error);
    return NextResponse.json({ error: "Failed to record completion" }, { status: 500 });
  }
}
