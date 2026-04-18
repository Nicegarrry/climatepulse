import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/supabase/server";
import { isFlagshipStatus } from "@/lib/podcast/flagship-statuses";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("editor");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sets: string[] = [];
  const values: unknown[] = [];
  let p = 1;

  if (typeof body.title === "string" && body.title.trim()) {
    sets.push(`title = $${p++}`);
    values.push(body.title.trim());
  }
  if (body.concept === null || typeof body.concept === "string") {
    sets.push(`concept = $${p++}`);
    values.push(body.concept);
  }
  if (body.format_id === null || typeof body.format_id === "string") {
    sets.push(`format_id = $${p++}`);
    values.push(body.format_id);
  }
  if (
    body.complexity === null ||
    (typeof body.complexity === "number" && body.complexity >= 1 && body.complexity <= 5)
  ) {
    sets.push(`complexity = $${p++}`);
    values.push(
      body.complexity === null ? null : Math.round(body.complexity as number)
    );
  }
  if (body.scheduled_for === null || typeof body.scheduled_for === "string") {
    sets.push(`scheduled_for = $${p++}`);
    values.push(body.scheduled_for);
  }
  if (Array.isArray(body.assigned_characters)) {
    sets.push(`assigned_characters = $${p++}`);
    values.push(body.assigned_characters);
  }
  if (body.production_notes === null || typeof body.production_notes === "string") {
    sets.push(`production_notes = $${p++}`);
    values.push(body.production_notes);
  }
  if (isFlagshipStatus(body.status)) {
    sets.push(`status = $${p++}`);
    values.push(body.status);
    if (body.status === "published") {
      sets.push(`published_at = COALESCE(published_at, NOW())`);
    }
  }

  if (sets.length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  values.push(id);

  try {
    const result = await pool.query(
      `UPDATE flagship_episodes SET ${sets.join(", ")} WHERE id = $${p}
       RETURNING id, title, status, scheduled_for, format_id, complexity,
                 assigned_characters, production_notes, episode_number`,
      values
    );
    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error("[flagship-episodes PATCH] failed:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("editor");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  try {
    const result = await pool.query(
      `UPDATE flagship_episodes SET status = 'archived' WHERE id = $1 AND status != 'archived'`,
      [id]
    );
    return NextResponse.json({ ok: true, archived: result.rowCount });
  } catch (err) {
    console.error("[flagship-episodes DELETE] failed:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
