import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/supabase/server";
import { generateBriefingForUser, DigestError } from "@/lib/digest/generate";
import { applyEditorialOverrides } from "@/lib/digest/editorial-overrides";
import { sydneyDateString } from "@/lib/podcast/date";
import type { DailyBriefing } from "@/lib/types";

// Fast first-run generation (Gemini Flash, no web-search/RAG) lands in seconds,
// but keep generous headroom for the slow tail.
export const maxDuration = 300;

// Coalesce concurrent first-run generations for the same user (initial load +
// a second tab, etc.) onto a single in-flight promise so we don't pay for two
// Flash calls. Per-instance only; the DB upsert handles cross-instance races,
// and a fast Flash call is cheap, so this is sufficient.
const inFlight = new Map<string, Promise<DailyBriefing>>();

function getOrStartFastGeneration(userId: string): Promise<DailyBriefing> {
  const existing = inFlight.get(userId);
  if (existing) return existing;
  // `fast: true` -> Gemini Flash, no web-search pre-pass, no prior-coverage RAG.
  const p = generateBriefingForUser(userId, { fast: true });
  inFlight.set(userId, p);
  void p.finally(() => inFlight.delete(userId));
  return p;
}

// ─── POST handler — generate today's briefing for a user ──────────────────

export async function POST(req: NextRequest) {
  // Manual trigger requires admin OR cron secret
  const authHeader = req.headers.get("authorization");
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  if (!isCron) {
    const auth = await requireAuth("admin");
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
  }

  const body = await req.json().catch(() => ({}));
  const useMock = body.mock === true;
  const userId = body.userId || "test-user-1";

  try {
    const briefing = await generateBriefingForUser(userId, { mock: useMock });
    return NextResponse.json(briefing);
  } catch (err) {
    if (err instanceof DigestError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Digest generation error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// ─── GET handler — fetch today's persisted briefing ───────────────────────

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const requestedUserId = req.nextUrl.searchParams.get("userId");
  // Users can only fetch their own briefing
  if (requestedUserId && requestedUserId !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const userId = requestedUserId || auth.user.id;

  try {
    // Briefings are keyed by Sydney date (see generate.ts and step5Podcast).
    // Using UTC here returned yesterday's row for users who opened the app
    // between 00:00–10:00 AEST.
    const today = sydneyDateString();
    let result;
    try {
      result = await pool.query(
        `SELECT id, user_id, date, stories, digest, generated_at,
                editorial_overrides, suppressed_story_ids
         FROM daily_briefings
         WHERE user_id = $1 AND date = $2
         ORDER BY generated_at DESC
         LIMIT 1`,
        [userId, today]
      );
    } catch {
      // Fallback if editorial columns aren't migrated yet.
      result = await pool.query(
        `SELECT id, user_id, date, stories, digest, generated_at
         FROM daily_briefings
         WHERE user_id = $1 AND date = $2
         ORDER BY generated_at DESC
         LIMIT 1`,
        [userId, today]
      );
    }

    if (result.rows.length > 0) {
      const row = result.rows[0];
      let articlesCount: number | undefined;
      try {
        const countResult = await pool.query(
          `SELECT COUNT(*) FROM enriched_articles ea
           JOIN raw_articles ra ON ra.id = ea.raw_article_id
           WHERE ra.published_at >= NOW() - INTERVAL '32 hours'`
        );
        articlesCount = parseInt(countResult.rows[0].count, 10);
      } catch {
        /* non-critical */
      }
      const digest = applyEditorialOverrides(
        row.digest,
        row.editorial_overrides ?? {},
        row.suppressed_story_ids ?? []
      );
      return NextResponse.json({
        status: "ready",
        briefing: {
          id: row.id,
          user_id: row.user_id,
          date: row.date,
          stories: row.stories,
          digest,
          generated_at: row.generated_at,
          articles_analysed: articlesCount,
        } as DailyBriefing,
      });
    }
  } catch (err) {
    console.warn("[digest] daily_briefings lookup failed:", err);
  }

  // No briefing for today yet — generate a fast first briefing (Gemini Flash,
  // no web-search/RAG) synchronously and return it. Awaiting here (rather than
  // the old fire-and-forget) means the work can't be frozen when the response
  // is sent, so the briefing reliably lands; Flash keeps it to a few seconds.
  // The nightly Sonnet cron upgrades this row in place on its next run.
  try {
    const briefing = await getOrStartFastGeneration(userId);
    return NextResponse.json({ status: "ready", briefing });
  } catch (err) {
    console.error("[digest] on-demand fast generation failed:", err);
    return NextResponse.json(
      {
        status: "error",
        error: "Could not generate your briefing right now. Please retry.",
        briefing: null,
      },
      { status: 503 }
    );
  }
}
