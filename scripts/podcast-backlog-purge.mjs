// Purge old unprocessed podcast-feed items from raw_articles.
//
// Criteria: source_name ends with "(Podcast)" AND no enriched_articles row
// AND published_at is more than 3 days old (safely past the 32h digest
// window). Already-enriched rows are never touched — they remain in the
// historical record and can appear in past briefings.
//
// The RSS poller was updated with a MAX_ARTICLE_AGE_DAYS=7 filter so the
// same items won't be re-ingested on the next poll.

import { Pool } from "pg";
const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]+/, "");
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

const dry = process.argv.includes("--dry");

const preview = await pool.query(`
  SELECT ra.source_name, COUNT(*)::int AS n
    FROM raw_articles ra
    LEFT JOIN enriched_articles ea ON ea.raw_article_id = ra.id
    LEFT JOIN full_text_articles ft ON ft.raw_article_id = ra.id
   WHERE ra.source_name LIKE '%(Podcast)%'
     AND ea.id IS NULL
     AND ra.published_at < NOW() - INTERVAL '3 days'
   GROUP BY ra.source_name
   ORDER BY n DESC
`);

console.log("=== Rows that will be deleted ===");
console.table(preview.rows);
const total = preview.rows.reduce((sum, r) => sum + r.n, 0);
console.log(`TOTAL: ${total}`);

if (dry) {
  console.log("\n(dry run — nothing deleted)");
  await pool.end();
  process.exit(0);
}

// Clean up any full_text_articles FK rows first to avoid constraint issues.
const ftResult = await pool.query(`
  DELETE FROM full_text_articles
   WHERE raw_article_id IN (
     SELECT ra.id
       FROM raw_articles ra
       LEFT JOIN enriched_articles ea ON ea.raw_article_id = ra.id
      WHERE ra.source_name LIKE '%(Podcast)%'
        AND ea.id IS NULL
        AND ra.published_at < NOW() - INTERVAL '3 days'
   )
`);
console.log(`\nDeleted ${ftResult.rowCount} full_text_articles rows`);

const raResult = await pool.query(`
  DELETE FROM raw_articles ra
   WHERE ra.source_name LIKE '%(Podcast)%'
     AND NOT EXISTS (SELECT 1 FROM enriched_articles ea WHERE ea.raw_article_id = ra.id)
     AND ra.published_at < NOW() - INTERVAL '3 days'
`);
console.log(`Deleted ${raResult.rowCount} raw_articles rows`);

await pool.end();
