import { NextResponse, type NextRequest } from "next/server";
import pool from "@/lib/db";
import { getAuthUser } from "@/lib/supabase/server";
import type { MaccSession } from "@/lib/automacc/v4-types";

// Uses the Node pg pool — must run on the Node runtime, not Edge.
export const runtime = "nodejs";

interface SessionRow {
  payload: MaccSession;
  updated_at: string;
}

/**
 * GET /api/automacc/session
 * Reads the authenticated user's MaccSession row.
 * - 401 if no auth.
 * - 200 { session: MaccSession | null } on success.
 * - 200 { session: null, error } on DB failure (client falls back to localStorage).
 */
export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { rows } = await pool.query<SessionRow>(
      `SELECT payload, updated_at
         FROM public.macc_sessions
        WHERE user_id = $1
        LIMIT 1`,
      [user.id],
    );

    const row = rows[0];
    if (!row) {
      return NextResponse.json({ session: null }, { status: 200 });
    }

    // Defensive: only return v4 payloads. Anything else looks like corruption
    // or a stale shape — let the client fall back to localStorage.
    const payload = row.payload;
    if (!payload || payload.version !== 4) {
      return NextResponse.json({ session: null }, { status: 200 });
    }

    return NextResponse.json({ session: payload }, { status: 200 });
  } catch (err) {
    console.error("[api/automacc/session GET] failed", err);
    // Never throw — client must degrade gracefully to localStorage.
    return NextResponse.json(
      {
        session: null,
        error: err instanceof Error ? err.message : "Database error",
      },
      { status: 200 },
    );
  }
}

/**
 * PUT /api/automacc/session
 * Body: { session: MaccSession }
 * Upserts the row for the authenticated user.
 */
export async function PUT(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { session?: MaccSession };
  try {
    body = (await req.json()) as { session?: MaccSession };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const session = body.session;
  if (!session || typeof session !== "object") {
    return NextResponse.json(
      { error: "session required" },
      { status: 400 },
    );
  }
  if (session.version !== 4) {
    return NextResponse.json(
      { error: "Unsupported session version" },
      { status: 400 },
    );
  }

  try {
    const { rows } = await pool.query<{ updated_at: string }>(
      `INSERT INTO public.macc_sessions (user_id, payload)
            VALUES ($1, $2::jsonb)
       ON CONFLICT (user_id) DO UPDATE
              SET payload = EXCLUDED.payload,
                  updated_at = NOW()
        RETURNING updated_at`,
      [user.id, JSON.stringify(session)],
    );

    return NextResponse.json(
      { ok: true, updated_at: rows[0]?.updated_at ?? null },
      { status: 200 },
    );
  } catch (err) {
    console.error("[api/automacc/session PUT] failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Database error" },
      { status: 500 },
    );
  }
}
