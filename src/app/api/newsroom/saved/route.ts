import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { fetchSaved } from "@/lib/newsroom/feed-queries";

const DEFAULT_LIMIT = 60;

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const url = req.nextUrl;
  const sectorsParam = url.searchParams.get("sectors");
  const search = url.searchParams.get("q");
  const cursor = url.searchParams.get("cursor");
  const limitParam = Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(limitParam) ? limitParam : DEFAULT_LIMIT;

  const sectorSlugs = sectorsParam
    ? sectorsParam.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  try {
    const items = await fetchSaved({
      userId: user.id,
      sectorSlugs,
      search,
      cursor,
      limit,
    });
    const nextCursor =
      items.length === limit && items[items.length - 1]?.saved_at
        ? items[items.length - 1].saved_at
        : null;
    return NextResponse.json({ items, cursor: nextCursor });
  } catch (err) {
    console.error("[newsroom/saved] error:", err);
    return NextResponse.json(
      { error: "saved query failed", message: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
