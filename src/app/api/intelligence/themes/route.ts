import { NextRequest, NextResponse } from "next/server";
import { discoverThemes } from "@/lib/intelligence/retriever";
import { requireAuth } from "@/lib/supabase/server";
import { rateLimitOr429 } from "@/lib/surfaces/rate-limit";

export async function POST(req: NextRequest) {
  // Gate: discoverThemes fans out heavy aggregate SQL; login-only + throttle,
  // and floor min_articles so min_articles:0 can't force the all-domains sweep.
  const auth = await requireAuth();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const limited = rateLimitOr429({ surfaceId: "intelligence-themes", key: auth.user.id, limit: 20, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const body = await req.json();
    const {
      date_from,
      date_to,
      min_articles = 3,
    } = body as {
      date_from: string;
      date_to: string;
      min_articles?: number;
    };

    if (!date_from || !date_to) {
      return NextResponse.json(
        { error: "date_from and date_to are required" },
        { status: 400 }
      );
    }

    const themes = await discoverThemes(date_from, date_to, Math.max(3, Number(min_articles) || 3));

    return NextResponse.json({
      date_from,
      date_to,
      theme_count: themes.length,
      themes,
    });
  } catch (err) {
    console.error("Theme discovery error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Theme discovery failed" },
      { status: 500 }
    );
  }
}
