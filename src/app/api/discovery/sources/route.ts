import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  const { rows } = await pool.query(
    `SELECT s.*,
       (SELECT COUNT(*) FROM raw_articles ra WHERE ra.source_name = s.name AND ra.fetched_at > NOW() - INTERVAL '24 hours')::int AS articles_today
     FROM sources s
     ORDER BY s.name`
  );
  return NextResponse.json(rows);
}
