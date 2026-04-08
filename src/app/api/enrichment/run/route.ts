import { NextRequest, NextResponse } from "next/server";
import { runEnrichmentBatch } from "@/lib/enrichment/pipeline";

export const maxDuration = 120; // 10 individual Stage 2 calls + overhead

export async function POST(request: NextRequest) {
  try {
    const reenrich = request.nextUrl.searchParams.get("reenrich") === "true";
    const result = await runEnrichmentBatch({ reenrich });
    return NextResponse.json(result);
  } catch (err) {
    console.error("Enrichment batch failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Enrichment failed" },
      { status: 500 }
    );
  }
}
