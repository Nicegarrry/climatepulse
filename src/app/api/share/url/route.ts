import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { getOrCreateRefHash } from "@/lib/share";

// POST body:
//   { article_url, source: "linkedin"|"twitter"|"email"|"copy", campaign? }
//   — or —
//   { content_type: "podcast", episode_id, source, campaign? }
//
// Returns: { share_url: "climatepulse.app/share/story?..." }
//          or     { share_url: "climatepulse.app/share/podcast?..." }
//
// Called client-side before a share action so the ref hash is resolved
// server-side without exposing the raw user id. For LinkedIn/Twitter the
// client uses /api/share/draft (which returns the same share_url plus an
// AI-drafted blurb); this endpoint remains for plain "copy link" and email.

export async function POST(req: NextRequest) {
  const user = await getAuthUser();

  let body: {
    article_url?: string;
    episode_id?: string;
    content_type?: string;
    source?: string;
    campaign?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const contentType = (body.content_type ?? "story").toLowerCase();
  const source = (body.source ?? "link").toLowerCase();
  const campaign = body.campaign ?? new Date().toISOString().slice(0, 10);

  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || req.nextUrl.origin;

  const refHash = user ? await getOrCreateRefHash(user.id) : null;

  if (contentType === "podcast") {
    const episodeId = body.episode_id?.trim();
    if (!episodeId) {
      return NextResponse.json(
        { error: "episode_id required" },
        { status: 400 }
      );
    }
    const shareUrl = new URL("/share/podcast", base);
    shareUrl.searchParams.set("id", episodeId);
    shareUrl.searchParams.set("utm_source", source);
    shareUrl.searchParams.set("utm_medium", "story_share");
    shareUrl.searchParams.set("utm_campaign", campaign);
    if (refHash) shareUrl.searchParams.set("ref", refHash);
    return NextResponse.json({ share_url: shareUrl.toString() });
  }

  const articleUrl = body.article_url?.trim();
  if (!articleUrl) {
    return NextResponse.json({ error: "article_url required" }, { status: 400 });
  }

  try {
    const parsed = new URL(articleUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return NextResponse.json({ error: "invalid url" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }

  const shareUrl = new URL("/share/story", base);
  shareUrl.searchParams.set("u", articleUrl);
  shareUrl.searchParams.set("utm_source", source);
  shareUrl.searchParams.set("utm_medium", "story_share");
  shareUrl.searchParams.set("utm_campaign", campaign);
  if (refHash) shareUrl.searchParams.set("ref", refHash);

  return NextResponse.json({ share_url: shareUrl.toString() });
}
