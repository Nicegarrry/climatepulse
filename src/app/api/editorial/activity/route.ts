import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/server";
import {
  fetchActivity,
  type ActivityTargetType,
} from "@/lib/editorial/activity-log";

// GET /api/editorial/activity?since=ISO&until=ISO&target_type=&target_id=&actor=&limit=
export async function GET(req: NextRequest) {
  const auth = await requireAuth("editor");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const sp = req.nextUrl.searchParams;
  const parseDate = (v: string | null): Date | undefined => {
    if (!v) return undefined;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? undefined : d;
  };

  const allowedTypes = new Set<ActivityTargetType>([
    "daily_briefing",
    "weekly_digest",
    "source",
    "assignment",
  ]);
  const rawType = sp.get("target_type");
  const targetType = rawType && allowedTypes.has(rawType as ActivityTargetType)
    ? (rawType as ActivityTargetType)
    : undefined;

  const limitRaw = sp.get("limit");
  const limit = limitRaw ? parseInt(limitRaw, 10) : undefined;

  const entries = await fetchActivity({
    since: parseDate(sp.get("since")),
    until: parseDate(sp.get("until")),
    targetType,
    targetId: sp.get("target_id") ?? undefined,
    actorUserId: sp.get("actor") ?? undefined,
    limit: Number.isFinite(limit) ? limit : undefined,
  });

  return NextResponse.json({ entries });
}
