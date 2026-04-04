import { NextResponse } from "next/server";
import { testFullTextBySources } from "@/lib/discovery/fulltext";

export const maxDuration = 60;

export async function POST() {
  try {
    const results = await testFullTextBySources();
    return NextResponse.json(results);
  } catch (err) {
    console.error("Full text test failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Full text test failed" },
      { status: 500 }
    );
  }
}
