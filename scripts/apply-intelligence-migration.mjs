// Apply scripts/migrate-intelligence.sql via pg client on DATABASE_URL.
// Used because the Supabase MCP in this workspace is bound to a different
// project (coffeeclub) and the bundled supabase CLI has no "execute file"
// verb. The migration is wrapped in BEGIN/COMMIT and fully idempotent.

import { readFile } from "node:fs/promises";
import { Pool } from "pg";

const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]+/, "");
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

const sql = await readFile(new URL("./migrate-intelligence.sql", import.meta.url), "utf-8");
console.log(`Applying migrate-intelligence.sql (${sql.length} bytes)...`);

const client = await pool.connect();
try {
  await client.query(sql);
  console.log("✓ Migration applied");
} catch (err) {
  console.error("✗ Migration failed:", err.message);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
