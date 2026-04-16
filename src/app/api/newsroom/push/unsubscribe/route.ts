import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getAuthUser } from "@/lib/supabase/server";

interface Body {
  endpoint?: string;
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

  const endpoint = body.endpoint?.trim();
  if (!endpoint) {
    return NextResponse.json(
      { error: "endpoint required" },
      { status: 400 }
    );
  }

  try {
    await pool.query(
      `DELETE FROM user_push_subscriptions WHERE user_id = $1 AND endpoint = $2`,
      [user.id, endpoint]
    );

    // If they have no remaining endpoints, flip the pref off.
    const remaining = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM user_push_subscriptions WHERE user_id = $1`,
      [user.id]
    );
    if (Number(remaining.rows[0]?.count ?? 0) === 0) {
      await pool.query(
        `UPDATE user_profiles
            SET notification_prefs = notification_prefs
              || jsonb_build_object('urgency5_push', false)
          WHERE id = $1`,
        [user.id]
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[newsroom/push/unsubscribe] error:", err);
    return NextResponse.json(
      { error: "unsubscribe failed", message: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
