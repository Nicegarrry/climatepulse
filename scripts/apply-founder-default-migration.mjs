// Apply scripts/migrate-founder-default.sql via pg client on DATABASE_URL.
// Temporary — see the SQL file for revert instructions.

import { readFile } from "node:fs/promises";
import { Pool } from "pg";

const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]+/, "");
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

const sql = await readFile(new URL("./migrate-founder-default.sql", import.meta.url), "utf-8");
console.log(`Applying migrate-founder-default.sql (${sql.length} bytes)...`);

const client = await pool.connect();
try {
  const result = await client.query(sql);
  const updateResult = Array.isArray(result) ? result.find((r) => r.command === "UPDATE") : result;
  console.log("✓ Migration applied");
  if (updateResult?.rowCount !== undefined) {
    console.log(`  Backfilled ${updateResult.rowCount} free-tier user(s) to founder`);
  }
} catch (err) {
  console.error("✗ Migration failed:", err.message);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
