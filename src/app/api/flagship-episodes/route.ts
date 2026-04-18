import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/supabase/server";

export async function GET() {
  const auth = await requireAuth("editor");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const [episodes, formats, characters] = await Promise.all([
    pool.query(
      `SELECT id, title, concept, format_id, ai_suggested_format_id, status, complexity,
              scheduled_for, published_at, episode_number, assigned_characters,
              production_notes, linked_weekly_digest_id, created_at, updated_at
         FROM flagship_episodes
         ORDER BY
           CASE status
             WHEN 'scheduled' THEN 0 WHEN 'drafted' THEN 1 WHEN 'idea' THEN 2
             WHEN 'published' THEN 3 WHEN 'archived' THEN 4 END,
           COALESCE(scheduled_for, '9999-12-31'::date),
           title`
    ),
    pool.query(
      `SELECT id, display_name, emotional_register, typical_cadence, is_experimental
         FROM podcast_formats WHERE active = TRUE ORDER BY is_experimental, display_name`
    ),
    pool.query(
      `SELECT id, display_name, role
         FROM podcast_characters WHERE active = TRUE ORDER BY role, display_name`
    ),
  ]);

  return NextResponse.json({
    episodes: episodes.rows,
    formats: formats.rows,
    characters: characters.rows,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth("editor");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  const concept = typeof body.concept === "string" ? body.concept : null;
  const format_id = typeof body.format_id === "string" ? body.format_id : null;
  const complexity =
    typeof body.complexity === "number" && body.complexity >= 1 && body.complexity <= 5
      ? Math.round(body.complexity)
      : null;

  try {
    const result = await pool.query(
      `INSERT INTO flagship_episodes (title, concept, format_id, complexity, status)
       VALUES ($1, $2, $3, $4, 'idea')
       RETURNING id, title, status, scheduled_for, format_id, complexity`,
      [title, concept, format_id, complexity]
    );
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error("[flagship-episodes POST] failed:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
