// Survey the podcast backlog before deleting anything.
import { Pool } from "pg";
const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]+/, "");
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

const [bySource, byAge, alreadyEnriched] = await Promise.all([
  pool.query(`
    SELECT ra.source_name,
           COUNT(*)::int                         AS total,
           COUNT(ea.id)::int                     AS enriched,
           (COUNT(*) - COUNT(ea.id))::int        AS pending,
           MIN(ra.published_at)                  AS oldest,
           MAX(ra.published_at)                  AS newest
      FROM raw_articles ra
      LEFT JOIN enriched_articles ea ON ea.raw_article_id = ra.id
     WHERE ra.source_name LIKE '%(Podcast)%'
     GROUP BY ra.source_name
     ORDER BY total DESC
  `),
  pool.query(`
    SELECT CASE
             WHEN ra.published_at >= NOW() - INTERVAL '3 days'  THEN '0-3 days'
             WHEN ra.published_at >= NOW() - INTERVAL '7 days'  THEN '3-7 days'
             WHEN ra.published_at >= NOW() - INTERVAL '30 days' THEN '7-30 days'
             WHEN ra.published_at >= NOW() - INTERVAL '90 days' THEN '30-90 days'
             ELSE '>90 days'
           END AS bucket,
           COUNT(*)::int AS n
      FROM raw_articles ra
      LEFT JOIN enriched_articles ea ON ea.raw_article_id = ra.id
     WHERE ra.source_name LIKE '%(Podcast)%'
       AND ea.id IS NULL
     GROUP BY 1
     ORDER BY MIN(ra.published_at) DESC
  `),
  pool.query(`
    SELECT COUNT(*)::int AS n
      FROM raw_articles ra
      JOIN enriched_articles ea ON ea.raw_article_id = ra.id
     WHERE ra.source_name LIKE '%(Podcast)%'
  `),
]);

console.log("=== Podcast sources in raw_articles ===");
console.table(bySource.rows.map(r => ({
  source: r.source_name,
  total: r.total,
  enriched: r.enriched,
  pending: r.pending,
  oldest: r.oldest?.toISOString().slice(0, 10),
  newest: r.newest?.toISOString().slice(0, 10),
})));

console.log("=== Pending podcast items by age ===");
console.table(byAge.rows);

console.log(`=== Already-enriched podcast items (will NOT be touched): ${alreadyEnriched.rows[0].n} ===`);
await pool.end();
