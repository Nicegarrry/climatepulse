import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

const TEST_USER_ID = "test-user-1";

// ─── POST — record implicit signal ────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, story_id, metadata } = body;

    if (!type || !story_id) {
      return NextResponse.json(
        { error: "type and story_id required" },
        { status: 400 }
      );
    }

    const timestamp = new Date().toISOString();

    if (type === "accordion_open") {
      // Append to accordion_opens JSONB: { story_id: [timestamps] }
      await pool.query(
        `UPDATE user_profiles
         SET accordion_opens = jsonb_set(
           COALESCE(accordion_opens, '{}'),
           $1,
           (COALESCE(accordion_opens->$2, '[]'::jsonb) || to_jsonb($3::text))
         ),
         updated_at = NOW()
         WHERE id = $4`,
        [`{${story_id}}`, story_id, timestamp, TEST_USER_ID]
      );
    } else if (type === "ring_tap") {
      await pool.query(
        `UPDATE user_profiles
         SET story_ring_taps = jsonb_set(
           COALESCE(story_ring_taps, '{}'),
           $1,
           (COALESCE(story_ring_taps->$2, '[]'::jsonb) || to_jsonb($3::text))
         ),
         updated_at = NOW()
         WHERE id = $4`,
        [`{${story_id}}`, story_id, timestamp, TEST_USER_ID]
      );
    } else if (type === "source_click") {
      // Future: track link clicks for engagement analysis
      // No-op for now, just acknowledge
    } else {
      return NextResponse.json(
        { error: `Unknown signal type: ${type}` },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    // Non-fatal — signals are best-effort
    console.warn("Signal tracking error:", err);
    return NextResponse.json({ ok: true });
  }
}
