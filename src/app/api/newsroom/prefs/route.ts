import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getAuthUser } from "@/lib/supabase/server";

interface Body {
  urgency5_push?: boolean;
  newsroom_threshold?: number;
}

export async function PATCH(req: NextRequest) {
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

  const merge: Record<string, unknown> = {};
  if (typeof body.urgency5_push === "boolean") {
    merge.urgency5_push = body.urgency5_push;
  }
  if (
    typeof body.newsroom_threshold === "number" &&
    body.newsroom_threshold >= 1 &&
    body.newsroom_threshold <= 5
  ) {
    merge.newsroom_threshold = Math.round(body.newsroom_threshold);
  }

  if (Object.keys(merge).length === 0) {
    return NextResponse.json(
      { error: "no valid fields supplied" },
      { status: 400 }
    );
  }

  try {
    await pool.query(
      `UPDATE user_profiles
          SET notification_prefs = notification_prefs || $2::jsonb
        WHERE id = $1`,
      [user.id, JSON.stringify(merge)]
    );

    const refreshed = await pool.query<{ notification_prefs: unknown }>(
      `SELECT notification_prefs FROM user_profiles WHERE id = $1`,
      [user.id]
    );

    return NextResponse.json({
      ok: true,
      notification_prefs: refreshed.rows[0]?.notification_prefs ?? null,
    });
  } catch (err) {
    console.error("[newsroom/prefs] error:", err);
    return NextResponse.json(
      { error: "update failed", message: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const r = await pool.query<{ notification_prefs: unknown; primary_sectors: string[] | null }>(
    `SELECT notification_prefs, primary_sectors FROM user_profiles WHERE id = $1`,
    [user.id]
  );
  return NextResponse.json({
    notification_prefs: r.rows[0]?.notification_prefs ?? null,
    primary_sectors: r.rows[0]?.primary_sectors ?? [],
  });
}
