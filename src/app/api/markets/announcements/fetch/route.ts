import { NextRequest, NextResponse } from "next/server";
import { fetchAllAnnouncements } from "@/lib/markets/asx-client";
import { isTradingHours, describeSydneyClock } from "@/lib/markets/trading-hours";

export const maxDuration = 120;

function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

// Admin-triggered (dashboard button) — POST, no cron auth, no time gate.
export async function POST() {
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
