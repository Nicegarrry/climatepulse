import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import pool from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const ticker = searchParams.get("ticker");
    const hours = parseInt(searchParams.get("hours") ?? "24", 10);

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    conditions.push(`released_at > NOW() - INTERVAL '${hours} hours'`);

    if (ticker) {
      params.push(ticker);
      conditions.push(`ticker = $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await pool.query(
      `SELECT * FROM asx_announcements ${where} ORDER BY released_at DESC LIMIT 200`,
      params,
    );

    return NextResponse.json({ announcements: rows, count: rows.length });
  } catch (err) {
    console.error("[api/markets/announcements] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch announcements" },
      { status: 500 },
    );
  }
}
