import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/supabase/server";
import { generateBriefingForUser, DigestError } from "@/lib/digest/generate";
import type { DailyBriefing } from "@/lib/types";

// Claude Sonnet + optional web-search pre-pass can take >60s for a single user.
export const maxDuration = 300;

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
    const today = new Date().toISOString().split("T")[0];
    const result = await pool.query(
      `SELECT id, user_id, date, stories, digest, generated_at
       FROM daily_briefings
       WHERE user_id = $1 AND date = $2
       ORDER BY generated_at DESC
       LIMIT 1`,
      [userId, today]
    );

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
      return NextResponse.json({
        id: row.id,
        user_id: row.user_id,
        date: row.date,
        stories: row.stories,
        digest: row.digest,
        generated_at: row.generated_at,
        articles_analysed: articlesCount,
      } as DailyBriefing);
    }
  } catch {
    // Table might not exist yet — fall through to mock
  }

  const { MOCK_BRIEFING } = await import("@/lib/mock-digest");
  return NextResponse.json(MOCK_BRIEFING);
}
