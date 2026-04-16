import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const auth = await requireAuth("admin");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = req.nextUrl;
  const hours = parseInt(searchParams.get("hours") || "24", 10);
  const source = searchParams.get("source");
  const limit = Math.min(parseInt(searchParams.get("limit") || "200", 10), 500);

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (hours > 0) {
    conditions.push(`fetched_at > NOW() - INTERVAL '${hours} hours'`);
  }

  if (source) {
    conditions.push(`source_name = $${paramIdx++}`);
    params.push(source);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const { rows } = await pool.query(
    `SELECT * FROM raw_articles ${where} ORDER BY COALESCE(published_at, fetched_at) DESC LIMIT $${paramIdx}`,
    [...params, limit]
  );

  return NextResponse.json(rows);
}
