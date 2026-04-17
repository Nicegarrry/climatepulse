import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getAuthUser } from "@/lib/supabase/server";

const VALID_TYPES = new Set([
  "read",
  "expand",
  "thumbs_up",
  "thumbs_down",
]);

interface Body {
  raw_article_id?: string;
  article_url?: string;
  daily_briefing_id?: string | null;
  story_id?: string | null;
  type?: string;
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const type = body.type?.trim();
  if (!type || !VALID_TYPES.has(type)) {
    return NextResponse.json({ error: "invalid type" }, { status: 400 });
  }

  // Resolve raw_article_id — caller can pass it directly or by article_url.
  let rawId = body.raw_article_id?.trim() || null;
  if (!rawId && body.article_url) {
    const lookup = await pool.query<{ id: string }>(
      `SELECT id FROM raw_articles WHERE article_url = $1 LIMIT 1`,
      [body.article_url]
    );
    rawId = lookup.rows[0]?.id ?? null;
  }

  if (!rawId) {
    return NextResponse.json(
      { error: "raw_article_id or known article_url required" },
      { status: 400 }
    );
  }

  try {
    await pool.query(
      `INSERT INTO user_briefing_interactions
         (user_id, raw_article_id, daily_briefing_id, story_id, interaction_type)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        user.id,
        rawId,
        body.daily_briefing_id ?? null,
        body.story_id ?? null,
        type,
      ]
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[briefing/interact] error:", err);
    return NextResponse.json(
      { error: "write failed", message: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
