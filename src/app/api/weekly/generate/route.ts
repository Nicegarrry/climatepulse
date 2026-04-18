import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/supabase/server";
import { generateWeeklyReport } from "@/lib/weekly/generate";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
    if (!isCron) {
      const auth = await requireAuth("admin");
      if ("error" in auth) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
      }
    }

    const weekStartParam = req.nextUrl.searchParams.get("weekStart") ?? undefined;
    const result = await generateWeeklyReport(weekStartParam);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Weekly report generation:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    const status = msg.startsWith("No enriched articles") ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function GET() {
  const auth = await requireAuth();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  try {
    const { rows } = await pool.query(
      "SELECT * FROM weekly_reports ORDER BY week_start DESC LIMIT 1"
    );
    if (rows.length === 0) return NextResponse.json({ report: null });
    return NextResponse.json({ report: rows[0] });
  } catch (err) {
    console.error("Weekly report fetch:", err);
    return NextResponse.json({ report: null });
  }
}
