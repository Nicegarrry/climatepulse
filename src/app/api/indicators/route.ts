import { NextResponse } from "next/server";
import pool from "@/lib/db";
import type { IndicatorWithHistory } from "@/lib/indicators/types";

export const dynamic = "force-dynamic";

// GET /api/indicators
//
// Returns the catalogue + last 30 history rows per indicator. Single round
// trip via LATERAL join — sparkline data is small and stable so we don't
// paginate.
export async function GET() {
  try {
    const { rows } = await pool.query<{
      indicator: IndicatorWithHistory;
      history: { observed_at: string; value: number }[] | null;
    }>(
      `
      SELECT
        to_jsonb(i.*) AS indicator,
        COALESCE(h.history, '[]'::jsonb) AS history
      FROM indicators i
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(
          jsonb_build_object('observed_at', v.observed_at, 'value', v.value)
          ORDER BY v.observed_at ASC
        ) AS history
        FROM (
          SELECT observed_at, value
          FROM indicator_values
          WHERE indicator_id = i.id
          ORDER BY observed_at DESC
          LIMIT 30
        ) v
      ) h ON TRUE
      WHERE i.status <> 'dormant'
      ORDER BY i.sector, i.name
      `
    );

    const indicators: IndicatorWithHistory[] = rows.map((r) => ({
      ...r.indicator,
      history: (r.history ?? []).slice().sort((a, b) =>
        a.observed_at.localeCompare(b.observed_at)
      ),
    }));

    return NextResponse.json({ indicators });
  } catch (err) {
    console.error("[api/indicators] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
