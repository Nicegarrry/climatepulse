import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/supabase/server";
import { logActivity } from "@/lib/editorial/activity-log";

// PATCH /api/weekly/digests/[id]/schedule
// body: { scheduled_for: ISO | null }
// Setting scheduled_for flips status → 'scheduled'. Setting null reverts to
// 'draft'. The /api/weekly/digests/scheduled-send cron scans for due rows.
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("editor");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { scheduled_for?: string | null };

  const scheduledFor = body.scheduled_for ? new Date(body.scheduled_for) : null;
  if (body.scheduled_for && (!scheduledFor || Number.isNaN(scheduledFor.getTime()))) {
    return NextResponse.json({ error: "invalid scheduled_for" }, { status: 400 });
  }
  if (scheduledFor && scheduledFor.getTime() <= Date.now()) {
    return NextResponse.json(
      { error: "scheduled_for must be in the future" },
      { status: 400 }
    );
  }

  try {
    const { rows } = await pool.query(
      `UPDATE weekly_digests
          SET scheduled_for = $2,
              status = CASE WHEN $2::timestamptz IS NULL THEN 'draft' ELSE 'scheduled' END,
              updated_at = NOW()
        WHERE id = $1
        RETURNING id, status, scheduled_for`,
      [id, scheduledFor?.toISOString() ?? null]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    void logActivity({
      actorUserId: auth.user.id,
      targetType: "weekly_digest",
      targetId: id,
      action: scheduledFor ? "scheduled" : "unscheduled",
      payload: { scheduled_for: scheduledFor?.toISOString() ?? null },
    });

    return NextResponse.json({ ok: true, ...rows[0] });
  } catch (err) {
    console.error("[weekly/schedule] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
