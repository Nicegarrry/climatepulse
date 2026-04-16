import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getAuthUser } from "@/lib/supabase/server";

interface Body {
  raw_article_id?: string;
  note?: string;
}

async function readBody(req: NextRequest): Promise<Body | null> {
  try {
    return (await req.json()) as Body;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const body = await readBody(req);
  const rawId = body?.raw_article_id?.trim();
  const note = body?.note?.trim() ?? null;
  if (!rawId) {
    return NextResponse.json({ error: "raw_article_id required" }, { status: 400 });
  }

  try {
    // Look up the matching newsroom_item if one exists, so the saved row
    // points at it (helps the clippings board and pre-bump hook).
    const ni = await pool.query<{ id: string }>(
      `SELECT id FROM newsroom_items WHERE raw_article_id = $1 LIMIT 1`,
      [rawId]
    );
    const newsroomItemId = ni.rows[0]?.id ?? null;

    await pool.query(
      `INSERT INTO user_saved_articles (user_id, raw_article_id, newsroom_item_id, note)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, raw_article_id) DO UPDATE
         SET note = COALESCE(EXCLUDED.note, user_saved_articles.note),
             saved_at = NOW()`,
      [user.id, rawId, newsroomItemId, note]
    );

    // Append to interaction log so the briefing-bump hook sees the save.
    await pool.query(
      `INSERT INTO user_newsroom_interactions (user_id, raw_article_id, interaction_type)
       VALUES ($1, $2, 'save')`,
      [user.id, rawId]
    );

    return NextResponse.json({ ok: true, saved: true });
  } catch (err) {
    console.error("[newsroom/save POST] error:", err);
    return NextResponse.json(
      { error: "save failed", message: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const body = await readBody(req);
  const rawId = body?.raw_article_id?.trim();
  if (!rawId) {
    return NextResponse.json({ error: "raw_article_id required" }, { status: 400 });
  }

  try {
    await pool.query(
      `DELETE FROM user_saved_articles WHERE user_id = $1 AND raw_article_id = $2`,
      [user.id, rawId]
    );
    await pool.query(
      `INSERT INTO user_newsroom_interactions (user_id, raw_article_id, interaction_type)
       VALUES ($1, $2, 'unsave')`,
      [user.id, rawId]
    );
    return NextResponse.json({ ok: true, saved: false });
  } catch (err) {
    console.error("[newsroom/save DELETE] error:", err);
    return NextResponse.json(
      { error: "unsave failed", message: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
