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
      `SELECT current_streak, longest_streak, last_completed_date, streak_started_date
       FROM user_streaks WHERE user_id = $1`,
      [userId]
    );

    if (rows.length === 0) {
      return NextResponse.json({
        current_streak: 0,
        longest_streak: 0,
        last_completed_date: null,
        streak_started_date: null,
        briefed_today: false,
      });
    }

    const streak = rows[0];
    const today = new Date().toISOString().slice(0, 10);
    const briefedToday = streak.last_completed_date
      ? new Date(streak.last_completed_date).toISOString().slice(0, 10) === today
      : false;

    return NextResponse.json({
      current_streak: streak.current_streak,
      longest_streak: streak.longest_streak,
      last_completed_date: streak.last_completed_date,
      streak_started_date: streak.streak_started_date,
      briefed_today: briefedToday,
    });
  } catch (error) {
    console.error("[analytics/streak] Error:", error);
    return NextResponse.json({ error: "Failed to fetch streak" }, { status: 500 });
  }
}
