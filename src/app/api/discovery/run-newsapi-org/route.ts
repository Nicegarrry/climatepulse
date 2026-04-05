import { NextResponse } from "next/server";
import { fetchNewsApiOrg } from "@/lib/discovery/newsapi-org";

export const maxDuration = 60;

export async function POST() {
  const result = await fetchNewsApiOrg();
  return NextResponse.json(result);
}
