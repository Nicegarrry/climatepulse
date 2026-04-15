import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

// GET /api/weekly/reports/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const { rows } = await pool.query(
      "SELECT * FROM weekly_reports WHERE id = $1",
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    return NextResponse.json({ report: rows[0] });
  } catch (err) {
    console.error("weekly report get:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
