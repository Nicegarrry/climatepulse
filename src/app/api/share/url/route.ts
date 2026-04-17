import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { getOrCreateRefHash } from "@/lib/share";

// POST { article_url, source: "linkedin"|"twitter"|"email"|"copy", campaign?: string }
// → { share_url: "...climatepulse.app/share/story?..." }
// Called from the client before a share action so the ref hash is resolved
// server-side without exposing the raw user id.
export async function POST(req: NextRequest) {
  const user = await getAuthUser();

  let body: {
    article_url?: string;
    source?: string;
    campaign?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const articleUrl = body.article_url?.trim();
  if (!articleUrl) {
    return NextResponse.json({ error: "article_url required" }, { status: 400 });
  }

  // Validate the article URL so we can't be used as an open share of arbitrary
  // data.
  try {
    const parsed = new URL(articleUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return NextResponse.json({ error: "invalid url" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }

  const source = (body.source ?? "link").toLowerCase();
  const campaign = body.campaign ?? new Date().toISOString().slice(0, 10);

  const refHash = user ? await getOrCreateRefHash(user.id) : null;

  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    req.nextUrl.origin;

  const shareUrl = new URL("/share/story", base);
  shareUrl.searchParams.set("u", articleUrl);
  shareUrl.searchParams.set("utm_source", source);
  shareUrl.searchParams.set("utm_medium", "story_share");
  shareUrl.searchParams.set("utm_campaign", campaign);
  if (refHash) shareUrl.searchParams.set("ref", refHash);

  return NextResponse.json({ share_url: shareUrl.toString() });
}
