import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/supabase/server";

// GET /api/editorial/source-health
// Lightweight, editor-accessible summary of source health for the
// persistent corner widget. A source is "unhealthy" when it has
// 3+ consecutive failures (matches the internal alert threshold).
export async function GET() {
  const auth = await requireAuth("editor");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, name, source_type, consecutive_failures,
              last_success_at, last_error, is_active
         FROM sources
        WHERE is_active = TRUE
        ORDER BY consecutive_failures DESC, name ASC`
    );

    const unhealthy = rows.filter((r) => r.consecutive_failures >= 3);
    return NextResponse.json({
      total: rows.length,
      unhealthy_count: unhealthy.length,
      unhealthy: unhealthy.map((r) => ({
        id: r.id,
        name: r.name,
        type: r.source_type,
        consecutive_failures: r.consecutive_failures,
        last_success_at: r.last_success_at,
        last_error: r.last_error,
      })),
    });
  } catch (err) {
    console.error("[source-health] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
