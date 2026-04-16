import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/server";
import { categoriseOneBatch } from "@/lib/categorise/engine";

export const maxDuration = 30;

export async function POST() {
  try {
    const auth = await requireAuth("admin");
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

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
