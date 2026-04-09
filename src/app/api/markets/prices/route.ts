import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  try {
    const { rows } = await pool.query(`
      SELECT DISTINCT ON (ticker) ticker, trade_date, open_price, close_price, day_high, day_low, volume, change_percent
      FROM asx_prices
      ORDER BY ticker, trade_date DESC
    `);

    return NextResponse.json({ prices: rows });
  } catch (err) {
    console.error("[api/markets/prices] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch prices" },
      { status: 500 },
    );
  }
}
