// Smoke test: verify podcast-evolution schema + seeds + /api/podcast/archive query.
import { Pool } from "pg";

const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]+/, "");
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

const checks = [
  {
    name: "new tables exist",
    sql: `SELECT table_name FROM information_schema.tables
          WHERE table_schema='public'
          AND table_name IN ('voice_profiles','podcast_characters','podcast_formats',
                             'flagship_episodes','themed_schedule','user_podcast_interactions')
          ORDER BY table_name`,
  },
  {
    name: "podcast_episodes new columns",
    sql: `SELECT column_name FROM information_schema.columns
          WHERE table_name='podcast_episodes'
          AND column_name IN ('tier','archetype','theme_slug','flagship_episode_id',
                              'character_ids','music_bed_url','mix_manifest')
          ORDER BY column_name`,
  },
  {
    name: "variant unique index present",
    sql: `SELECT indexname FROM pg_indexes
          WHERE tablename='podcast_episodes'
          AND indexname='idx_podcast_episodes_variant_uniq'`,
  },
  {
    name: "seed counts",
    sql: `SELECT
            (SELECT count(*) FROM voice_profiles) AS voices,
            (SELECT count(*) FROM podcast_characters) AS characters,
            (SELECT count(*) FROM podcast_formats) AS formats,
            (SELECT count(*) FROM themed_schedule) AS themes,
            (SELECT count(*) FROM flagship_episodes) AS flagship`,
  },
  {
    name: "archive route query (global, daily, last 7d)",
    sql: `SELECT id, briefing_date, tier, archetype, theme_slug, flagship_episode_id,
                 audio_url, audio_duration_seconds, audio_format, generated_at,
                 script->>'title' AS title
          FROM podcast_episodes
          WHERE tier = 'daily'
            AND briefing_date >= (NOW() - INTERVAL '7 days')::date
            AND user_id IS NULL
          ORDER BY briefing_date DESC, generated_at DESC
          LIMIT 5`,
  },
];

const client = await pool.connect();
try {
  for (const check of checks) {
    console.log(`\n--- ${check.name} ---`);
    const { rows } = await client.query(check.sql);
    console.log(JSON.stringify(rows, null, 2));
  }
} catch (err) {
  console.error("✗ Smoke test failed:", err.message);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
