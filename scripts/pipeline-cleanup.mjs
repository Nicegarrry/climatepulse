import { Pool } from "pg";
const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]+/, "");
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

const r = await pool.query(
  `UPDATE pipeline_runs
      SET status = 'failed',
          completed_at = NOW(),
          error = 'Function killed by Vercel maxDuration before step could persist result'
    WHERE status = 'running'
      AND started_at < NOW() - INTERVAL '3 minutes'
    RETURNING id, started_at`
);
console.log("Marked stale runs as failed:", r.rows.length);
for (const row of r.rows) console.log("  ", row.id, row.started_at.toISOString());
await pool.end();
