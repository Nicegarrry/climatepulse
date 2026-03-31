import { NextResponse } from "next/server";
import { categoriseUncategorised } from "@/lib/categorise/engine";

export const maxDuration = 120;

export async function POST() {
  try {
    const result = await categoriseUncategorised();
    return NextResponse.json(result);
  } catch (err) {
    console.error("Categorisation run failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Categorisation failed" },
      { status: 500 }
    );
  }
}
