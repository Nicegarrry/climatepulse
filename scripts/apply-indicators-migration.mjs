// Apply the indicators migrations via pg client on DATABASE_URL.
// Mirrors apply-intelligence-migration.mjs.
//
//   pnpm tsx scripts/apply-indicators-migration.mjs
//
// Idempotent — both SQL files are wrapped in BEGIN/COMMIT and use
// CREATE TABLE IF NOT EXISTS / ON CONFLICT DO NOTHING.
//
// Depends on scripts/migrations/learn/001-learn-prelude.sql (creates the
// shared update_updated_at_column trigger fn). That migration must already
// be applied; on prod (Supabase) it is.

import { readFile } from "node:fs/promises";
import { Pool } from "pg";

const url = (process.env.DATABASE_URL ?? "").replace(/[?&]sslmode=[^&]+/, "");
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
const isLocal = /@(localhost|127\.0\.0\.1|host\.docker\.internal)/.test(url);
const pool = new Pool({
  connectionString: url,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

const FILES = [
  "./migrations/indicators/001-indicators.sql",
  "./migrations/indicators/002-seed-catalogue.sql",
  "./migrations/indicators/003-scrapers.sql",
];

const client = await pool.connect();
try {
  for (const rel of FILES) {
    const sql = await readFile(new URL(rel, import.meta.url), "utf-8");
    console.log(`Applying ${rel} (${sql.length} bytes)...`);
    await client.query(sql);
    console.log(`✓ Applied ${rel}`);
  }

  const { rows } = await client.query("SELECT COUNT(*)::int AS n FROM indicators");
  console.log(`✓ indicators rows: ${rows[0].n}`);
} catch (err) {
  console.error("✗ Migration failed:", err instanceof Error ? err.message : err);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
