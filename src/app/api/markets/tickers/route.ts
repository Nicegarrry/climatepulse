import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/supabase/server";

export async function GET() {
  const auth = await requireAuth();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { rows } = await pool.query(`
      SELECT t.*, p.close_price, p.change_percent, p.volume, p.day_high, p.day_low, p.trade_date
      FROM asx_tickers t
      LEFT JOIN LATERAL (
        SELECT close_price, change_percent, volume, day_high, day_low, trade_date
        FROM asx_prices
        WHERE ticker = t.ticker
        ORDER BY trade_date DESC
        LIMIT 1
      ) p ON true
      WHERE t.is_active = true
      ORDER BY t.sub_sector, t.ticker
    `);

    return NextResponse.json({ tickers: rows });
  } catch (err) {
    console.error("[api/markets/tickers] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch tickers" },
      { status: 500 },
    );
  }
}
