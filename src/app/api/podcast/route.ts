import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const date = req.nextUrl.searchParams.get("date") ?? undefined;

  try {
    const { getTodaysPodcast, getLatestPodcast } = await import("@/lib/podcast/storage");

    // Try exact date first, then fall back to most recent episode
    const episode = await getTodaysPodcast(date) ?? await getLatestPodcast();

    if (episode) {
      return NextResponse.json(episode);
    }
  } catch {
    // Table may not exist yet — fall through to mock
  }

  // Return mock data for UI development
  const { MOCK_PODCAST_EPISODE } = await import("@/lib/mock-podcast");
  return NextResponse.json(MOCK_PODCAST_EPISODE);
}
