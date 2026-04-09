import { NextResponse } from "next/server";
import { fetchAllAnnouncements } from "@/lib/markets/asx-client";

export const maxDuration = 120;

export async function POST() {
  try {
    const result = await fetchAllAnnouncements();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/markets/announcements/fetch] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch announcements" },
      { status: 500 },
    );
  }
}
