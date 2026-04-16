import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/supabase/server";

// GET /api/weekly/reports?limit=10
export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const limit = Math.min(
    parseInt(req.nextUrl.searchParams.get("limit") || "10", 10),
    50
  );

  try {
    const { rows } = await pool.query(
      "SELECT * FROM weekly_reports ORDER BY week_start DESC LIMIT $1",
      [limit]
    );
    return NextResponse.json({ reports: rows });
  } catch (err) {
    console.error("weekly reports list:", err);
    return NextResponse.json({ reports: [] });
  }
}
