import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/supabase/server";

interface StoryOverride {
  editors_pick?: boolean;
  editorial_note?: string | null;
  analysis_override?: string | null;
}

interface Body {
  overrides?: Record<string, StoryOverride>;
  suppressed_story_ids?: string[];
}

// GET /api/briefing/[id]/editorial
// → { overrides, suppressed_story_ids, editorially_updated_at }
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("editor");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await ctx.params;

  const { rows } = await pool.query(
    `SELECT id, user_id, date, stories, digest, editorial_overrides,
            suppressed_story_ids, editorially_updated_at
       FROM daily_briefings
      WHERE id = $1`,
    [id]
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(rows[0]);
}

// PATCH /api/briefing/[id]/editorial
// body: { overrides?: {...}, suppressed_story_ids?: [...] }
// Merges overrides key-by-key; replaces suppressed list if provided.
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("editor");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await ctx.params;
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (body.overrides && typeof body.overrides === "object") {
    // Merge top-level keys atomically. `|| '{}'::jsonb` guards against
    // historical NULL values from before the column default landed.
    updates.push(
      `editorial_overrides = COALESCE(editorial_overrides, '{}'::jsonb) || $${idx}::jsonb`
    );
    values.push(JSON.stringify(body.overrides));
    idx++;
  }

  if (Array.isArray(body.suppressed_story_ids)) {
    updates.push(`suppressed_story_ids = $${idx}`);
    values.push(body.suppressed_story_ids.map(String));
    idx++;
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  updates.push(`editorially_updated_at = NOW()`);
  values.push(id);

  try {
    const { rowCount } = await pool.query(
      `UPDATE daily_briefings SET ${updates.join(", ")} WHERE id = $${idx}`,
      values
    );
    if (rowCount === 0) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[briefing/editorial] error:", err);
    return NextResponse.json(
      { error: "write failed", message: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
