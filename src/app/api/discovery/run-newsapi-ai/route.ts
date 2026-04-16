import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/server";
import { fetchNewsApiAi } from "@/lib/discovery/newsapi-ai";

export const maxDuration = 60;

export async function POST() {
  const auth = await requireAuth("admin");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const result = await fetchNewsApiAi();
  return NextResponse.json(result);
}
