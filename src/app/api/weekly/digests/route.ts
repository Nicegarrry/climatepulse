import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

// GET /api/weekly/digests?status=published&limit=10
export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status") || "published";
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "10", 10), 50);

  try {
    const whereClause = status === "all" ? "" : "WHERE status = $1";
    const params = status === "all" ? [] : [status];

    const { rows } = await pool.query(
      `SELECT * FROM weekly_digests ${whereClause}
       ORDER BY week_start DESC
       LIMIT ${limit}`,
      params
    );

    return NextResponse.json({ digests: rows });
  } catch (err) {
    // Table may not exist yet — return empty
    console.error("weekly digests list:", err);
    return NextResponse.json({ digests: [] });
  }
}

// POST /api/weekly/digests — create or upsert a digest
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      week_start,
      week_end,
      headline,
      editor_narrative,
      weekly_number,
      curated_stories,
      theme_commentary,
      outlook,
      report_id,
    } = body;

    if (!week_start || !headline || !editor_narrative || !curated_stories) {
      return NextResponse.json(
        { error: "Missing required fields: week_start, headline, editor_narrative, curated_stories" },
        { status: 400 }
      );
    }

    const id = `wdigest-${Date.now()}`;
    const weekEnd = week_end || (() => {
      const d = new Date(week_start + "T00:00:00");
      d.setDate(d.getDate() + 6);
      return d.toISOString().slice(0, 10);
    })();

    const { rows } = await pool.query(
      `INSERT INTO weekly_digests (
        id, report_id, week_start, week_end, status,
        headline, editor_narrative, weekly_number, curated_stories,
        theme_commentary, outlook
      ) VALUES ($1, $2, $3, $4, 'draft', $5, $6, $7, $8, $9, $10)
      ON CONFLICT (week_start) DO UPDATE SET
        headline = EXCLUDED.headline,
        editor_narrative = EXCLUDED.editor_narrative,
        weekly_number = EXCLUDED.weekly_number,
        curated_stories = EXCLUDED.curated_stories,
        theme_commentary = EXCLUDED.theme_commentary,
        outlook = EXCLUDED.outlook,
        report_id = COALESCE(EXCLUDED.report_id, weekly_digests.report_id),
        updated_at = NOW()
      RETURNING *`,
      [
        id,
        report_id || null,
        week_start,
        weekEnd,
        headline,
        editor_narrative,
        JSON.stringify(weekly_number || null),
        JSON.stringify(curated_stories),
        JSON.stringify(theme_commentary || null),
        outlook || null,
      ]
    );

    return NextResponse.json({ digest: rows[0] }, { status: 201 });
  } catch (err) {
    console.error("weekly digest create:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
