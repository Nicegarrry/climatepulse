import { NextResponse } from "next/server";
import { fetchNewsApiAi } from "@/lib/discovery/newsapi-ai";

export const maxDuration = 60;

export async function POST() {
  const result = await fetchNewsApiAi();
  return NextResponse.json(result);
}
