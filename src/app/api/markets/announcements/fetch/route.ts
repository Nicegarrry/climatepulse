import { NextRequest, NextResponse } from "next/server";
import { fetchAllAnnouncements } from "@/lib/markets/asx-client";
import { isTradingHours, describeSydneyClock } from "@/lib/markets/trading-hours";
import { requireAuth } from "@/lib/supabase/server";
import { rateLimitOr429 } from "@/lib/surfaces/rate-limit";

export const maxDuration = 120;

function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

// User-triggered (dashboard button). Any logged-in user may refresh public ASX
// data (idempotent INSERT ... ON CONFLICT DO NOTHING); gated + throttled so the
// 120s function can't be pinned anonymously.
export async function POST() {
  const auth = await requireAuth();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const limited = rateLimitOr429({ surfaceId: "markets-announcements-fetch", key: auth.user.id, limit: 6, windowMs: 60_000 });
  if (limited) return limited;
  try {
    const result = await fetchAllAnnouncements();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/markets/announcements/fetch] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch announcements" },
      { status: 500 },
    );
  }
}

// Cron-triggered — GET with Bearer ${CRON_SECRET}. Scheduled every 30 min
// from a UTC superset that covers both AEST and AEDT trading windows;
// gated here to ASX continuous + closing auction (10:00–16:30 Sydney local).
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const force = req.nextUrl.searchParams.get("force") === "1";
  if (!force && !isTradingHours()) {
    return NextResponse.json({
      skipped: true,
      reason: "outside trading hours",
      sydney: describeSydneyClock(),
    });
  }

  try {
    const result = await fetchAllAnnouncements();
    return NextResponse.json({ ...result, sydney: describeSydneyClock() });
  } catch (err) {
    console.error("[api/markets/announcements/fetch cron] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch announcements" },
      { status: 500 },
    );
  }
}
