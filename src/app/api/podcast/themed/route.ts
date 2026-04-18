// Workstream B — themed weekly deep-dives. Runs daily; only generates
// when today's day_of_week matches an enabled themed_schedule row.

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/server";
import { runThemedPodcastsForToday } from "@/lib/podcast/workstream-b-themed";

export const maxDuration = 800;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  if (!isCron) {
    const auth = await requireAuth("admin");
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
  }

  let body: { date?: string } = {};
  try {
    body = (await req.json()) as { date?: string };
  } catch {
    // optional
  }

  const results = await runThemedPodcastsForToday(body.date);
  const generated = results.filter((r) => r.status === "generated").length;
  const failed = results.filter((r) => r.status === "failed").length;

  return NextResponse.json({
    ok: failed === 0,
    checked: results.length,
    generated,
    failed,
    results,
  });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
