import { NextResponse } from "next/server";
import { backfillAllPriceHistory } from "@/lib/markets/price-history";

export const maxDuration = 120;

export async function POST() {
  try {
    const result = await backfillAllPriceHistory();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/markets/prices/backfill] error:", err);
    return NextResponse.json(
      { error: "Failed to backfill price history" },
      { status: 500 },
    );
  }
}
