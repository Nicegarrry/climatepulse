import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export const maxDuration = 300;

// GET/POST /api/weekly/digests/scheduled-send
// Cron-triggered sweeper. Finds weekly_digests where status='scheduled' and
// scheduled_for <= NOW() and publishes them via the existing publish route
// logic (invoked directly to reuse email dispatch, LinkedIn draft, flagship
// auto-link).
//
// Auth: CRON_SECRET bearer token only.
async function handler(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let due: { id: string }[] = [];
  try {
    const { rows } = await pool.query<{ id: string }>(
      `SELECT id FROM weekly_digests
        WHERE status = 'scheduled'
          AND scheduled_for IS NOT NULL
          AND scheduled_for <= NOW()
        ORDER BY scheduled_for ASC
        LIMIT 5`
    );
    due = rows;
  } catch (err) {
    // Migration not applied — nothing to do.
    console.warn("[scheduled-send] scan failed (migration missing?):", err);
    return NextResponse.json({ published: 0, skipped: true });
  }

  if (due.length === 0) {
    return NextResponse.json({ published: 0 });
  }

  // Publish each via internal fetch so we reuse the full publish flow
  // (Resend email, LinkedIn draft, flagship link, activity log).
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const results: { id: string; ok: boolean; error?: string }[] = [];

  for (const row of due) {
    try {
      const res = await fetch(`${base}/api/weekly/digests/${row.id}/publish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${process.env.CRON_SECRET}`,
        },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        results.push({ id: row.id, ok: false, error: body.error ?? `status ${res.status}` });
        continue;
      }
      results.push({ id: row.id, ok: true });
    } catch (err) {
      results.push({
        id: row.id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    published: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}

export async function GET(req: NextRequest) {
  return handler(req);
}
export async function POST(req: NextRequest) {
  return handler(req);
}
