// Check the pgRAG / pgvector plumbing and whether enriched articles are being embedded.
import { Pool } from "pg";
const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]+/, "");
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

// 1. pgvector extension
const ext = await pool.query(`SELECT extname, extversion FROM pg_extension WHERE extname IN ('vector', 'pg_trgm')`);
console.log("=== Extensions ===");
for (const r of ext.rows) console.log(`  ${r.extname} v${r.extversion}`);

// 2. Embedding-related tables
const tables = await pool.query(`
  SELECT table_name
    FROM information_schema.tables
   WHERE table_schema = 'public'
     AND (table_name LIKE '%embedding%' OR table_name LIKE '%chunk%' OR table_name LIKE '%rag%' OR table_name LIKE '%vector%')
   ORDER BY table_name
`);
console.log("\n=== Embedding-related tables ===");
for (const r of tables.rows) console.log(`  ${r.table_name}`);

// 3. For each such table, row count + distinct content_type + most recent insert
for (const r of tables.rows) {
  const t = r.table_name;
  const cols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = $1`, [t]);
  const names = cols.rows.map(c => c.column_name);
  const hasContentType = names.includes("content_type");
  const hasCreatedAt = names.includes("created_at");
  const hasEmbeddedAt = names.includes("embedded_at");
  const stampCol = hasCreatedAt ? "created_at" : hasEmbeddedAt ? "embedded_at" : null;

  const count = await pool.query(`SELECT COUNT(*)::int AS n FROM ${t}`);
  console.log(`\n=== ${t} (${count.rows[0].n} rows) ===`);

  if (hasContentType) {
    const sel = stampCol
      ? `SELECT content_type, COUNT(*)::int AS n, MAX(${stampCol}) AS latest FROM ${t} GROUP BY content_type ORDER BY n DESC`
      : `SELECT content_type, COUNT(*)::int AS n FROM ${t} GROUP BY content_type ORDER BY n DESC`;
    const byType = await pool.query(sel);
    for (const row of byType.rows) {
      const latest = row.latest ? row.latest.toISOString() : "(no timestamp)";
      console.log(`  ${row.content_type.padEnd(20)} | ${row.n.toString().padStart(6)} | ${latest}`);
    }
  }
}

// 4. Compare: enriched articles vs. embeddings
const enriched = await pool.query(`SELECT COUNT(*)::int AS n FROM enriched_articles`);
console.log(`\n=== Coverage ===`);
console.log(`enriched_articles total: ${enriched.rows[0].n}`);

// Try to find the chunks/embeddings table and join
try {
  const matches = await pool.query(`
    SELECT
      (SELECT COUNT(DISTINCT ea.id)::int FROM enriched_articles ea
        WHERE EXISTS (SELECT 1 FROM rag_chunks c WHERE c.source_id = ea.id AND c.content_type = 'article')) AS embedded,
      (SELECT COUNT(*)::int FROM enriched_articles) AS enriched
  `);
  console.log(`enriched w/ embeddings:  ${matches.rows[0].embedded}`);
} catch (e) {
  // fallback — try different table names
  try {
    const matches = await pool.query(`
      SELECT COUNT(DISTINCT ea.id)::int AS n
        FROM enriched_articles ea
       WHERE EXISTS (SELECT 1 FROM article_embeddings c WHERE c.enriched_article_id = ea.id)
    `);
    console.log(`enriched w/ embeddings:  ${matches.rows[0].n}`);
  } catch {
    console.log(`(couldn't auto-match table; inspect the tables above)`);
  }
}

await pool.end();
