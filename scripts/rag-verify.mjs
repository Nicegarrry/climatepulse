// Post-backfill verification: index stats, coverage, sample similarity query.
import { Pool } from "pg";
const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]+/, "");
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

// 1. Overall stats
const overall = await pool.query(`
  SELECT content_type, COUNT(*)::int AS chunks,
         COUNT(DISTINCT source_id)::int AS sources,
         MIN(created_at)::text AS first,
         MAX(created_at)::text AS last
    FROM content_embeddings
   GROUP BY content_type
   ORDER BY chunks DESC
`);
console.log("=== Coverage by content_type ===");
console.table(overall.rows);

// 2. Coverage: enriched articles WITH vs WITHOUT embedding
const coverage = await pool.query(`
  SELECT
    (SELECT COUNT(*)::int FROM enriched_articles)                                                  AS enriched,
    (SELECT COUNT(DISTINCT source_id)::int FROM content_embeddings WHERE content_type = 'article') AS embedded,
    (SELECT COUNT(*)::int FROM podcast_episodes)                                                   AS podcasts_total,
    (SELECT COUNT(DISTINCT source_id)::int FROM content_embeddings WHERE content_type = 'podcast') AS podcasts_embedded,
    (SELECT COUNT(*)::int FROM daily_briefings)                                                    AS briefings_total,
    (SELECT COUNT(DISTINCT source_id)::int FROM content_embeddings WHERE content_type = 'daily_digest') AS briefings_embedded
`);
const c = coverage.rows[0];
console.log("=== Coverage comparison ===");
console.log(`  enriched_articles:   ${c.embedded}/${c.enriched}`);
console.log(`  podcast_episodes:    ${c.podcasts_embedded}/${c.podcasts_total}`);
console.log(`  daily_briefings:     ${c.briefings_embedded}/${c.briefings_total}`);

// 3. HNSW index present?
const idx = await pool.query(`
  SELECT indexname, indexdef
    FROM pg_indexes
   WHERE tablename = 'content_embeddings'
   ORDER BY indexname
`);
console.log("\n=== Indexes ===");
for (const r of idx.rows) console.log(`  ${r.indexname}`);

// 4. Sample similarity query (grab a real embedding and find its nearest neighbours)
const sample = await pool.query(`
  SELECT source_id, primary_domain, signal_type, embedding::text AS vec, chunk_text
    FROM content_embeddings
   WHERE content_type = 'article'
     AND primary_domain IS NOT NULL
   ORDER BY created_at DESC
   LIMIT 1
`);
if (sample.rows.length) {
  const query = sample.rows[0];
  console.log(`\n=== Nearest neighbours of a sample article ===`);
  console.log(`  anchor: domain=${query.primary_domain}, signal=${query.signal_type}`);
  console.log(`  text:   ${query.chunk_text.slice(0, 120).replace(/\n/g, " ")}...`);

  const nn = await pool.query(
    `SELECT content_type, source_id, primary_domain, signal_type,
            1 - (embedding <=> $1::vector) AS similarity,
            LEFT(chunk_text, 80) AS snippet
       FROM content_embeddings
      WHERE source_id <> $2
      ORDER BY embedding <=> $1::vector
      LIMIT 5`,
    [query.vec, query.source_id]
  );
  for (const row of nn.rows) {
    console.log(`  ${row.similarity.toFixed(3)} | ${row.content_type.padEnd(14)} | ${(row.primary_domain ?? "-").padEnd(14)} | ${row.snippet.replace(/\n/g, " ")}...`);
  }
}

await pool.end();
