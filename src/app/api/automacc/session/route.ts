import { NextResponse, type NextRequest } from "next/server";
import pool from "@/lib/db";
import { getAuthUser } from "@/lib/supabase/server";
import type { MaccSession } from "@/lib/automacc/v4-types";

// Uses the Node pg pool — must run on the Node runtime, not Edge.
export const runtime = "nodejs";

interface SessionRow {
  payload: MaccSession;
  session_id: string;
  updated_at: string;
}

function isValidSession(payload: unknown): payload is MaccSession {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  if (p.version !== 4) return false;
  if (typeof p.id !== "string" || p.id.length === 0) return false;
  return true;
}

/**
 * GET /api/automacc/session
 * Lists all MaccSessions belonging to the authenticated user.
 * Always 200 — empty list on no rows or DB error so client can degrade to
 * localStorage. Legacy single-row installs (session_id = 'default', payload
 * missing id/name from the v0 schema) are sanitised on the fly so they don't
 * disappear for users mid-upgrade.
 */
export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { rows } = await pool.query<SessionRow>(
      `SELECT payload, session_id, updated_at
         FROM public.macc_sessions
        WHERE user_id = $1
        ORDER BY updated_at DESC
        LIMIT 100`,
      [user.id],
    );

    const sessions: MaccSession[] = [];
    for (const row of rows) {
      const payload = row.payload as MaccSession | null;
      if (!payload || (payload as { version?: number }).version !== 4) {
        // Legacy / corrupted row — drop quietly.
        console.warn("[api/automacc/session GET] dropping non-v4 row", row.session_id);
        continue;
      }
      // Sanitise legacy v4 rows that pre-date the multi-session schema:
      // they lack id, name, createdAt. Backfill from the row's session_id.
      const sanitised: MaccSession = {
        id: payload.id || row.session_id || `legacy_${Date.now()}`,
        name: payload.name || "My company",
        version: 4,
        createdAt: payload.createdAt || row.updated_at,
        updatedAt: payload.updatedAt || row.updated_at,
        meta: payload.meta,
        sources: payload.sources ?? [],
        levers: payload.levers ?? [],
        step: payload.step ?? 1,
        aggressivenessPct: payload.aggressivenessPct ?? 100,
      };
      sessions.push(sanitised);
    }

    return NextResponse.json({ sessions }, { status: 200 });
  } catch (err) {
    console.error("[api/automacc/session GET] failed", err);
    return NextResponse.json(
      {
        sessions: [],
        error: err instanceof Error ? err.message : "Database error",
      },
      { status: 200 },
    );
  }
}

/**
 * PUT /api/automacc/session
 * Body: { session: MaccSession }
 * Upserts by (user_id, session.id). Returns { ok, updated_at }.
 */
export async function PUT(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { session?: unknown };
  try {
    body = (await req.json()) as { session?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const session = body.session;
  if (!isValidSession(session)) {
    return NextResponse.json({ error: "Invalid session payload" }, { status: 400 });
  }

  try {
    const { rows } = await pool.query<{ updated_at: string }>(
      `INSERT INTO public.macc_sessions (user_id, session_id, payload)
            VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (user_id, session_id) DO UPDATE
              SET payload = EXCLUDED.payload,
                  updated_at = NOW()
        RETURNING updated_at`,
      [user.id, session.id, JSON.stringify(session)],
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

/**
 * DELETE /api/automacc/session?id=<sessionId>
 * Idempotent — 200 even when no row matches.
 */
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id query param required" }, { status: 400 });
  }
  try {
    await pool.query(
      `DELETE FROM public.macc_sessions WHERE user_id = $1 AND session_id = $2`,
      [user.id, id],
    );
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[api/automacc/session DELETE] failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Database error" },
      { status: 500 },
    );
  }
}
