import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getAuthUser } from "@/lib/supabase/server";

interface Body {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
  userAgent?: string;
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
  const p256dh = body.keys?.p256dh?.trim();
  const auth = body.keys?.auth?.trim();
  const userAgent = body.userAgent?.slice(0, 255) ?? null;

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { error: "endpoint and keys.p256dh and keys.auth are required" },
      { status: 400 }
    );
  }

  try {
    // Upsert: re-subscribing on the same endpoint refreshes keys + clears
    // any prior failure count.
    await pool.query(
      `INSERT INTO user_push_subscriptions
         (user_id, endpoint, p256dh, auth, user_agent, failure_count)
       VALUES ($1, $2, $3, $4, $5, 0)
       ON CONFLICT (endpoint) DO UPDATE
         SET user_id = EXCLUDED.user_id,
             p256dh = EXCLUDED.p256dh,
             auth = EXCLUDED.auth,
             user_agent = EXCLUDED.user_agent,
             failure_count = 0,
             last_error_at = NULL`,
      [user.id, endpoint, p256dh, auth, userAgent]
    );

    // Default to opt-in once a subscription is recorded — the user has
    // already granted browser permission so it's clearly intentional.
    await pool.query(
      `UPDATE user_profiles
          SET notification_prefs = notification_prefs
            || jsonb_build_object('urgency5_push', true)
        WHERE id = $1`,
      [user.id]
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[newsroom/push/subscribe] error:", err);
    return NextResponse.json(
      { error: "subscribe failed", message: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
