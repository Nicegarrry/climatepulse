import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getAuthUser } from "@/lib/supabase/server";

type QuestionType = "scale" | "freeform" | "most_relevant";

const VALID_TYPES = new Set<QuestionType>(["scale", "freeform", "most_relevant"]);
const DISMISSAL_THRESHOLD = 10;
const SUPPRESSION_DAYS = 30;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// GET /api/feedback/daily
// → { should_prompt: boolean, question_type?: QuestionType, existing?: {...} }
export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const today = todayISO();

  try {
    // Suppression check
    const supp = await pool.query<{ feedback_suppressed_until: string | null }>(
      `SELECT feedback_suppressed_until FROM user_profiles WHERE id = $1`,
      [user.id]
    );
    const suppUntil = supp.rows[0]?.feedback_suppressed_until;
    if (suppUntil && suppUntil >= today) {
      return NextResponse.json({ should_prompt: false, suppressed_until: suppUntil });
    }

    // Today's entry
    const todayRow = await pool.query(
      `SELECT question_type, response, dismissed, created_at
         FROM user_daily_feedback
        WHERE user_id = $1 AND date = $2`,
      [user.id, today]
    );
    if (todayRow.rows.length > 0) {
      return NextResponse.json({
        should_prompt: false,
        existing: todayRow.rows[0],
      });
    }

    // Pick a stable question type for today from a date hash so the user gets
    // the same question across a session.
    const questionType = pickQuestion(today, user.id);
    return NextResponse.json({ should_prompt: true, question_type: questionType });
  } catch (err) {
    console.error("[feedback/daily GET] error:", err);
    return NextResponse.json({ should_prompt: false });
  }
}

// POST body: { question_type, response?: JSONB, dismissed?: boolean }
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let body: {
    question_type?: string;
    response?: unknown;
    dismissed?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const qtype = body.question_type as QuestionType | undefined;
  if (!qtype || !VALID_TYPES.has(qtype)) {
    return NextResponse.json({ error: "invalid question_type" }, { status: 400 });
  }

  const dismissed = body.dismissed === true;
  const today = todayISO();

  try {
    await pool.query(
      `INSERT INTO user_daily_feedback (user_id, date, question_type, response, dismissed)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, date) DO UPDATE
         SET question_type = EXCLUDED.question_type,
             response = COALESCE(EXCLUDED.response, user_daily_feedback.response),
             dismissed = user_daily_feedback.dismissed OR EXCLUDED.dismissed`,
      [user.id, today, qtype, dismissed ? null : body.response ?? null, dismissed]
    );

    // If the user just dismissed, check if they've dismissed the last N days
    // in a row. If so, suppress for SUPPRESSION_DAYS.
    if (dismissed) {
      const recent = await pool.query<{ dismissed: boolean; date: string }>(
        `SELECT dismissed, date FROM user_daily_feedback
          WHERE user_id = $1
          ORDER BY date DESC
          LIMIT $2`,
        [user.id, DISMISSAL_THRESHOLD]
      );
      if (
        recent.rows.length >= DISMISSAL_THRESHOLD &&
        recent.rows.every((r) => r.dismissed)
      ) {
        const until = new Date();
        until.setUTCDate(until.getUTCDate() + SUPPRESSION_DAYS);
        await pool.query(
          `UPDATE user_profiles SET feedback_suppressed_until = $1 WHERE id = $2`,
          [until.toISOString().slice(0, 10), user.id]
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[feedback/daily POST] error:", err);
    return NextResponse.json(
      { error: "write failed", message: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

function pickQuestion(date: string, userId: string): QuestionType {
  // Simple deterministic rotation via a crc-like sum so the user gets a
  // different question on consecutive days but the same one across sessions.
  let hash = 0;
  const seed = `${date}|${userId}`;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const types: QuestionType[] = ["scale", "freeform", "most_relevant"];
  return types[hash % types.length];
}
