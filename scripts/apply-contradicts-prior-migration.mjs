import { readFile } from "node:fs/promises";
import { Pool } from "pg";

const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]+/, "");
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

const sql = await readFile(new URL("./migrate-contradicts-prior.sql", import.meta.url), "utf-8");
console.log(`Applying migrate-contradicts-prior.sql (${sql.length} bytes)...`);

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
