import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  try {
    const { ticker } = await params;

    const { rows } = await pool.query(
      `SELECT close_price FROM asx_prices
       WHERE ticker = $1 AND close_price IS NOT NULL
       ORDER BY trade_date ASC
       LIMIT 30`,
      [ticker.toUpperCase()],
    );

    const sparkline = rows.map((r) => parseFloat(r.close_price));

    return NextResponse.json({ ticker: ticker.toUpperCase(), sparkline });
  } catch (err) {
    console.error("[api/markets/sparkline] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch sparkline" },
      { status: 500 },
    );
  }
}
