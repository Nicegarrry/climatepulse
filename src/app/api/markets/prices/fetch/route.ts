import { NextResponse } from "next/server";
import { fetchAllPrices } from "@/lib/markets/asx-client";

export const maxDuration = 120;

export async function POST() {
  try {
    const result = await fetchAllPrices();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/markets/prices/fetch] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch prices" },
      { status: 500 },
    );
  }
}
