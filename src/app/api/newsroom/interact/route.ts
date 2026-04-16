import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getAuthUser } from "@/lib/supabase/server";

const VALID_TYPES = new Set([
  "read",
  "expand",
  "thumbs_up",
  "thumbs_down",
  "save",
  "unsave",
]);

interface Body {
  raw_article_id?: string;
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

  const rawId = body.raw_article_id?.trim();
  const type = body.type?.trim();

  if (!rawId || !type || !VALID_TYPES.has(type)) {
    return NextResponse.json(
      { error: "invalid raw_article_id or type" },
      { status: 400 }
    );
  }

  try {
    await pool.query(
      `INSERT INTO user_newsroom_interactions (user_id, raw_article_id, interaction_type)
       VALUES ($1, $2, $3)`,
      [user.id, rawId, type]
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[newsroom/interact] error:", err);
    return NextResponse.json(
      { error: "write failed", message: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
