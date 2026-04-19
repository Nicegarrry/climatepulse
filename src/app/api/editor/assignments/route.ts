import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/supabase/server";
import { logActivity } from "@/lib/editorial/activity-log";

interface Assignment {
  id: number;
  user_id: string;
  week_start: string;
  week_end: string;
  assigned_by: string;
  note: string | null;
  created_at: string;
}

// GET /api/editor/assignments — list all (admin only)
export async function GET() {
  const auth = await requireAuth("admin");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { rows } = await pool.query<Assignment & { user_name: string | null; user_email: string }>(
    `SELECT a.id, a.user_id, a.week_start, a.week_end, a.assigned_by, a.note, a.created_at,
            p.name AS user_name, p.email AS user_email
       FROM editor_assignments a
       LEFT JOIN user_profiles p ON p.id = a.user_id
      ORDER BY a.week_start DESC, a.created_at DESC
      LIMIT 100`
  );

  return NextResponse.json({ assignments: rows });
}

// POST /api/editor/assignments
// body: { user_id, week_start, week_end, note? }
export async function POST(req: NextRequest) {
  const auth = await requireAuth("admin");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await req.json().catch(() => ({}))) as {
    user_id?: string;
    week_start?: string;
    week_end?: string;
    note?: string;
  };
  if (!body.user_id || !body.week_start || !body.week_end) {
    return NextResponse.json(
      { error: "user_id, week_start, week_end required" },
      { status: 400 }
    );
  }

  try {
    const { rows } = await pool.query<{ id: number }>(
      `INSERT INTO editor_assignments (user_id, week_start, week_end, assigned_by, note)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, week_start) DO UPDATE
         SET week_end = EXCLUDED.week_end,
             note = EXCLUDED.note,
             assigned_by = EXCLUDED.assigned_by
       RETURNING id`,
      [body.user_id, body.week_start, body.week_end, auth.user.id, body.note ?? null]
    );
    const id = rows[0].id;

    void logActivity({
      actorUserId: auth.user.id,
      targetType: "assignment",
      targetId: String(id),
      action: "assignment_created",
      payload: {
        assignee_user_id: body.user_id,
        week_start: body.week_start,
        week_end: body.week_end,
      },
    });

    return NextResponse.json({ id, ok: true });
  } catch (err) {
    console.error("[assignments] POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// DELETE /api/editor/assignments?id=<n>
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth("admin");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  try {
    const { rows } = await pool.query<Assignment>(
      `DELETE FROM editor_assignments WHERE id = $1 RETURNING *`,
      [id]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    void logActivity({
      actorUserId: auth.user.id,
      targetType: "assignment",
      targetId: id,
      action: "assignment_revoked",
      payload: {
        assignee_user_id: rows[0].user_id,
        week_start: rows[0].week_start,
        week_end: rows[0].week_end,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[assignments] DELETE error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
