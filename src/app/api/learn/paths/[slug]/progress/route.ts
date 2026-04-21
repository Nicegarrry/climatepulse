import { NextResponse, type NextRequest } from "next/server";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/supabase/server";

/**
 * POST /api/learn/paths/:slug/progress
 * Body: { item_id, completed }
 *
 * Marks a single learning_path_item complete (INSERT) or incomplete (DELETE).
 * Uniqueness on (user_id, item_id).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await requireAuth();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { slug } = await params;

  let body: { item_id?: string; completed?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const itemId = body.item_id?.trim();
  const completed = Boolean(body.completed);
  if (!itemId) {
    return NextResponse.json({ error: "item_id required" }, { status: 400 });
  }

  // Resolve path by slug and confirm the item belongs to it.
  const { rows: pathRows } = await pool.query<{ id: string }>(
    `SELECT id FROM learning_paths WHERE slug = $1`,
    [slug],
  );
  const pathId = pathRows[0]?.id;
  if (!pathId) {
    return NextResponse.json({ error: "path not found" }, { status: 404 });
  }

  const { rows: itemRows } = await pool.query<{ id: string }>(
    `SELECT id FROM learning_path_items WHERE id = $1 AND path_id = $2`,
    [itemId, pathId],
  );
  if (itemRows.length === 0) {
    return NextResponse.json(
      { error: "item not in this path" },
      { status: 400 },
    );
  }

  try {
    if (completed) {
      await pool.query(
        `INSERT INTO learning_path_progress
           (user_id, path_id, item_id, completed_at, dwell_seconds)
         VALUES ($1, $2, $3, NOW(), 0)
         ON CONFLICT (user_id, item_id) DO UPDATE
           SET completed_at = EXCLUDED.completed_at`,
        [auth.user.id, pathId, itemId],
      );
    } else {
      await pool.query(
        `DELETE FROM learning_path_progress
          WHERE user_id = $1 AND item_id = $2`,
        [auth.user.id, itemId],
      );
    }
    return NextResponse.json({ ok: true, completed });
  } catch (err) {
    console.error("[api/learn/paths/:slug/progress] failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 500 },
    );
  }
}
