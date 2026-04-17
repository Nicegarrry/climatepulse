// Deep probe: when did articles last get added, which sources, and what's stalling ingest.
import { Pool } from "pg";
const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]+/, "");
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

const [last, bySource, pending, sourcesCfg] = await Promise.all([
  pool.query(`SELECT created_at, source_name, title FROM raw_articles ORDER BY created_at DESC LIMIT 5`),
  pool.query(`SELECT source_name, COUNT(*)::int AS n, MAX(created_at) AS last_added FROM raw_articles WHERE created_at >= NOW() - INTERVAL '6 hours' GROUP BY source_name ORDER BY last_added DESC LIMIT 20`),
  pool.query(`SELECT COUNT(*)::int AS n FROM raw_articles WHERE id NOT IN (SELECT raw_article_id FROM full_text_articles WHERE raw_article_id IS NOT NULL)`),
  pool.query(`SELECT name, feed_url, source_type, last_polled, last_successful_poll, consecutive_failures, is_active FROM sources WHERE is_active = true ORDER BY last_polled DESC NULLS LAST LIMIT 30`),
]);

console.log("=== Most recent raw_articles ===");
for (const r of last.rows) console.log(`${r.created_at.toISOString()} | ${r.source_name} | ${r.title?.slice(0, 80)}`);

console.log("\n=== Articles added in last 6h, by source ===");
for (const r of bySource.rows) console.log(`${r.last_added.toISOString()} | ${r.source_name.padEnd(28)} | ${r.n}`);

console.log(`\n=== Backlog: raw_articles without full_text: ${pending.rows[0].n} ===`);

console.log("\n=== Active sources by last_polled ===");
for (const r of sourcesCfg.rows) {
  const last = r.last_polled?.toISOString() ?? "never";
  const ok = r.last_successful_poll?.toISOString() ?? "never";
  const tag = r.consecutive_failures > 0 ? `⚠️  ${r.consecutive_failures}x failures` : "ok";
  console.log(`${r.source_type.padEnd(8)} | last=${last.slice(0,19)} | ok=${ok.slice(0,19)} | ${tag.padEnd(18)} | ${r.name}`);
}

await pool.end();
