import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/indicators/review — list pending queue rows (admin only)
export async function GET(req: NextRequest) {
  const auth = await requireAuth("admin");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "pending_review";

  const { rows } = await pool.query(
    `SELECT
       q.id,
       q.indicator_id,
       q.proposed_indicator_slug,
       q.proposed_value,
       q.proposed_unit,
       q.proposed_geography,
       q.source_article_id,
       q.source_url,
       q.evidence_quote,
       q.detector_confidence,
       q.detector_reason,
       q.status,
       q.created_at,
       i.slug AS indicator_slug,
       i.name AS indicator_name,
       i.unit AS indicator_unit,
       i.geography AS indicator_geography,
       ra.title AS article_title,
       ra.source_name AS article_source
     FROM indicator_review_queue q
     LEFT JOIN indicators i ON i.id = q.indicator_id
     LEFT JOIN raw_articles ra ON ra.id = q.source_article_id
     WHERE q.status = $1
     ORDER BY q.created_at DESC
     LIMIT 200`,
    [status]
  );

  return NextResponse.json({ items: rows });
}

// POST /api/indicators/review/:id — approve or reject (admin only)
//
// We accept the row id in the body to keep this a single dynamic route file.
//   { id, action: 'approve' | 'reject', notes?: string }
// On approve: writes to indicator_values (provenance from queue row) and
// links it back via promoted_value_id.
export async function POST(req: NextRequest) {
  const auth = await requireAuth("admin");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await req.json().catch(() => null)) as {
    id?: string;
    action?: "approve" | "reject";
    notes?: string;
  } | null;
  if (!body?.id || !body.action) {
    return NextResponse.json({ error: "id and action required" }, { status: 400 });
  }

  const reviewerId = auth.profile.id;

  if (body.action === "reject") {
    await pool.query(
      `UPDATE indicator_review_queue
       SET status = 'rejected',
           reviewed_by = $1,
           reviewed_at = NOW(),
           review_notes = $2
       WHERE id = $3 AND status = 'pending_review'`,
      [reviewerId, body.notes ?? null, body.id]
    );
    return NextResponse.json({ ok: true });
  }

  // Approve — pull queue row, validate, insert into indicator_values, link back.
  const { rows: queueRows } = await pool.query(
    `SELECT q.*, i.unit AS indicator_unit, i.geography AS indicator_geography
     FROM indicator_review_queue q
     LEFT JOIN indicators i ON i.id = q.indicator_id
     WHERE q.id = $1 AND q.status = 'pending_review'
     LIMIT 1`,
    [body.id]
  );
  if (queueRows.length === 0) {
    return NextResponse.json({ error: "Queue row not found or not pending" }, { status: 404 });
  }
  const q = queueRows[0];
  if (!q.indicator_id) {
    return NextResponse.json(
      {
        error:
          "Cannot auto-approve a novel-indicator hint — create the indicator in the catalogue first, then approve.",
      },
      { status: 400 }
    );
  }
  if (q.proposed_value === null || q.proposed_value === undefined) {
    return NextResponse.json(
      { error: "Cannot approve: proposed_value is null." },
      { status: 400 }
    );
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const insertResult = await client.query(
      `INSERT INTO indicator_values (
         indicator_id, value, unit, geography, observed_at,
         source_type, source_article_id, source_url, evidence_quote, confidence
       ) VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, NOW()), 'article', $6, $7, $8, $9)
       RETURNING id`,
      [
        q.indicator_id,
        q.proposed_value,
        q.indicator_unit,
        q.indicator_geography,
        null,
        q.source_article_id,
        q.source_url,
        q.evidence_quote,
        q.detector_confidence,
      ]
    );
    const promotedId = insertResult.rows[0].id as string;
    await client.query(
      `UPDATE indicator_review_queue
       SET status = 'approved',
           reviewed_by = $1,
           reviewed_at = NOW(),
           review_notes = $2,
           promoted_value_id = $3
       WHERE id = $4`,
      [reviewerId, body.notes ?? null, promotedId, body.id]
    );
    await client.query("COMMIT");
    return NextResponse.json({ ok: true, promoted_value_id: promotedId });
  } catch (err) {
    await client.query("ROLLBACK");
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Insert failed" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
