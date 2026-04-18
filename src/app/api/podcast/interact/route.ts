import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/server";
import { isPodcastInteractionType, recordInteraction } from "@/lib/podcast/telemetry";

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const payload = body as {
    podcast_episode_id?: unknown;
    type?: unknown;
    position_seconds?: unknown;
  };

  if (typeof payload.podcast_episode_id !== "string" || !payload.podcast_episode_id) {
    return NextResponse.json({ error: "podcast_episode_id required" }, { status: 400 });
  }
  if (!isPodcastInteractionType(payload.type)) {
    return NextResponse.json({ error: "invalid interaction type" }, { status: 400 });
  }

  const pos =
    typeof payload.position_seconds === "number" && Number.isFinite(payload.position_seconds)
      ? Math.max(0, Math.floor(payload.position_seconds))
      : null;

  try {
    await recordInteraction(auth.user.id, payload.podcast_episode_id, payload.type, pos);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[podcast/interact] failed:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
