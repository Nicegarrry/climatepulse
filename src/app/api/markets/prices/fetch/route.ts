import { NextRequest, NextResponse } from "next/server";
import { fetchAllPrices } from "@/lib/markets/asx-client";
import { describeSydneyClock } from "@/lib/markets/trading-hours";

export const maxDuration = 120;

function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

async function runFetch() {
  const result = await fetchAllPrices();
  return result;
}

// Admin-triggered (dashboard button) — POST, no cron auth.
export async function POST() {
  try {
    const result = await runFetch();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/markets/prices/fetch] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch prices" },
      { status: 500 },
    );
  }
}

// Cron-triggered — GET with Bearer ${CRON_SECRET}. Scheduled 3x/day at
// 10:01, 13:00, 16:15 Sydney local (dual UTC entries cover AEST & AEDT).
// fetchAllPrices is idempotent (UPSERT on ticker+date) so a duplicate fire
// during DST changeover is harmless.
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await runFetch();
    return NextResponse.json({ ...result, sydney: describeSydneyClock() });
  } catch (err) {
    console.error("[api/markets/prices/fetch cron] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch prices" },
      { status: 500 },
    );
  }
}
