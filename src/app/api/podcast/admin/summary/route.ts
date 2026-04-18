import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/supabase/server";

export async function GET() {
  const auth = await requireAuth("admin");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const [voices, characters, formats, themes, flagship, episodeCounts, interactions] =
      await Promise.all([
        pool.query(
          `SELECT id, display_name, provider, provider_voice_id, accent, gender, active
             FROM voice_profiles ORDER BY active DESC, display_name`
        ),
        pool.query(
          `SELECT id, display_name, role, voice_profile_id, active
             FROM podcast_characters ORDER BY role, display_name`
        ),
        pool.query(
          `SELECT id, display_name, emotional_register, typical_cadence, is_experimental, active
             FROM podcast_formats ORDER BY is_experimental, display_name`
        ),
        pool.query(
          `SELECT id, title, day_of_week, local_time, cornerstone_character_id, enabled
             FROM themed_schedule ORDER BY day_of_week`
        ),
        pool.query(
          `SELECT id, title, status, scheduled_for, episode_number
             FROM flagship_episodes
             WHERE status IN ('idea','drafted','scheduled','published')
             ORDER BY
               CASE status WHEN 'scheduled' THEN 0 WHEN 'drafted' THEN 1 WHEN 'idea' THEN 2 ELSE 3 END,
               COALESCE(scheduled_for, '9999-12-31'::date), title`
        ),
        pool.query(
          `SELECT tier, COUNT(*)::int AS n,
                  MAX(briefing_date) AS latest
             FROM podcast_episodes
             WHERE user_id IS NULL
             GROUP BY tier`
        ),
        pool.query(
          `SELECT interaction_type, COUNT(*)::int AS n
             FROM user_podcast_interactions
             WHERE created_at >= NOW() - INTERVAL '7 days'
             GROUP BY interaction_type
             ORDER BY interaction_type`
        ),
      ]);

    return NextResponse.json({
      voices: voices.rows,
      characters: characters.rows,
      formats: formats.rows,
      themes: themes.rows,
      flagship: flagship.rows,
      episode_counts_by_tier: episodeCounts.rows,
      interactions_last_7d: interactions.rows,
    });
  } catch (err) {
    console.error("[podcast/admin/summary] failed:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
