// One-off diagnostic: dump pipeline state for the live troubleshooting session.
import { Pool } from "pg";

const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]+/, "");
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

const [articles10m, articlesToday, fulltextToday, enriched24h, briefingsToday, podcastsToday, runs] = await Promise.all([
  pool.query(`SELECT COUNT(*)::int AS n FROM raw_articles WHERE created_at >= NOW() - INTERVAL '10 minutes'`),
  pool.query(`SELECT COUNT(*)::int AS n FROM raw_articles WHERE created_at::date = CURRENT_DATE`),
  pool.query(`SELECT COUNT(*)::int AS n FROM full_text_articles WHERE extracted_at::date = CURRENT_DATE`),
  pool.query(`SELECT COUNT(*)::int AS n FROM enriched_articles WHERE enriched_at >= NOW() - INTERVAL '24 hours'`),
  pool.query(`SELECT COUNT(*)::int AS n FROM daily_briefings WHERE date = CURRENT_DATE`),
  pool.query(`SELECT COUNT(*)::int AS n FROM podcast_episodes WHERE briefing_date = CURRENT_DATE`),
  pool.query(`SELECT id, started_at, completed_at, status, (steps->0->>'name') AS step, COALESCE(LEFT(error, 120), '') AS err FROM pipeline_runs ORDER BY started_at DESC LIMIT 5`),
]);

console.log("=== Data freshness ===");
console.log(`raw_articles last 10min: ${articles10m.rows[0].n}`);
console.log(`raw_articles today:      ${articlesToday.rows[0].n}`);
console.log(`full_text today:         ${fulltextToday.rows[0].n}`);
console.log(`enriched last 24h:       ${enriched24h.rows[0].n}`);
console.log(`briefings today:         ${briefingsToday.rows[0].n}`);
console.log(`podcasts today:          ${podcastsToday.rows[0].n}`);
console.log("\n=== Recent pipeline_runs ===");
for (const r of runs.rows) {
  const elapsed = r.completed_at
    ? `${Math.round((new Date(r.completed_at) - new Date(r.started_at)) / 1000)}s`
    : `RUNNING ${Math.round((Date.now() - new Date(r.started_at)) / 1000)}s`;
  console.log(`${r.id} | ${r.step ?? "(multi)"} | ${r.status} | ${elapsed}${r.err ? " | " + r.err : ""}`);
}
await pool.end();
