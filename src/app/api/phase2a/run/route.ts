import { NextResponse } from "next/server";
import { categoriseOneBatch } from "@/lib/categorise/engine";

export const maxDuration = 30;

export async function POST() {
  try {
    const result = await categoriseOneBatch();
    return NextResponse.json(result);
  } catch (err) {
    console.error("Categorisation batch failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Categorisation failed" },
      { status: 500 }
    );
  }
}
