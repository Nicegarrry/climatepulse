import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getAuthUser } from "@/lib/supabase/server";

// GET /share/story?u=<url>&utm_source=...&utm_medium=...&utm_campaign=...&ref=<hash>
// Logs the click and 302-redirects to the original article URL.
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const target = params.get("u");

  // Validate target URL. Reject anything that isn't an absolute http(s) URL so
  // the interstitial can't be weaponised as an open redirect.
  let parsed: URL | null = null;
  if (target) {
    try {
      parsed = new URL(target);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") parsed = null;
    } catch {
      parsed = null;
    }
  }

  if (!parsed) {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }

  const user = await getAuthUser();

  // Resolve raw_article_id if the URL matches a known raw article (best-effort).
  let rawArticleId: string | null = null;
  try {
    const match = await pool.query<{ id: string }>(
      `SELECT id FROM raw_articles WHERE article_url = $1 LIMIT 1`,
      [parsed.toString()]
    );
    rawArticleId = match.rows[0]?.id ?? null;
  } catch {
    rawArticleId = null;
  }

  try {
    await pool.query(
      `INSERT INTO share_clicks
         (user_id, article_url, raw_article_id, utm_source, utm_medium, utm_campaign, ref_hash, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        user?.id ?? null,
        parsed.toString(),
        rawArticleId,
        params.get("utm_source"),
        params.get("utm_medium"),
        params.get("utm_campaign"),
        params.get("ref"),
        req.headers.get("user-agent")?.slice(0, 500) ?? null,
      ]
    );
  } catch (err) {
    // Don't block the redirect if logging fails — user experience wins over analytics.
    console.error("[share/story] log failed:", err);
  }

  return NextResponse.redirect(parsed.toString(), 302);
}
