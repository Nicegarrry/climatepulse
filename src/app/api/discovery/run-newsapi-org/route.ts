import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/server";
import { fetchNewsApiOrg } from "@/lib/discovery/newsapi-org";

export const maxDuration = 60;

export async function POST() {
  const auth = await requireAuth("admin");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const result = await fetchNewsApiOrg();
  return NextResponse.json(result);
}
