import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/supabase/server";
import { generateBriefingForUser, DigestError } from "@/lib/digest/generate";
import { logActivity } from "@/lib/editorial/activity-log";

// Regeneration may run Claude Sonnet + RAG fetches; give it room.
export const maxDuration = 300;

// POST /api/briefing/[id]/regenerate
// Editor-triggered rebuild of today's briefing. Editorial overrides are
// preserved across regeneration (the generate flow upserts `digest` and
// `stories` only; `editorial_overrides` and `suppressed_story_ids` survive).
export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("editor");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await ctx.params;

  const { rows } = await pool.query(
    `SELECT user_id, date FROM daily_briefings WHERE id = $1`,
    [id]
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "Briefing not found" }, { status: 404 });
  }
  const { user_id: briefingUserId, date: briefingDate } = rows[0];

  try {
    const briefing = await generateBriefingForUser(briefingUserId);

    void logActivity({
      actorUserId: auth.user.id,
      targetType: "daily_briefing",
      targetId: briefing.id,
      action: "regenerated",
      payload: {
        briefing_user_id: briefingUserId,
        date: briefingDate,
      },
    });

    return NextResponse.json({ ok: true, briefing_id: briefing.id });
  } catch (err) {
    if (err instanceof DigestError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[briefing/regenerate] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
