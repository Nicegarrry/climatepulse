import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "50")));
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const excludeStatus = searchParams.get("exclude_status");
    const search = searchParams.get("search");

    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (type) {
      conditions.push(`entity_type = $${idx++}`);
      params.push(type);
    }
    if (status) {
      conditions.push(`status = $${idx++}`);
      params.push(status);
    }
    if (excludeStatus) {
      conditions.push(`status != $${idx++}`);
      params.push(excludeStatus);
    }
    if (search) {
      conditions.push(`canonical_name ILIKE $${idx++}`);
      params.push(`%${search}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM entities ${whereClause}`,
      params
    );

    const offset = (page - 1) * limit;
    const dataParams = [...params, limit, offset];
    const result = await pool.query(
      `SELECT * FROM entities ${whereClause} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
      dataParams
    );

    return NextResponse.json({
      entities: result.rows,
      total: parseInt(countResult.rows[0].total),
      page,
      limit,
    });
  } catch (error) {
    console.error("Error fetching entities:", error);
    return NextResponse.json(
      { error: "Failed to fetch entities" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { canonical_name, entity_type, aliases, status } = body;

    const result = await pool.query(
      `INSERT INTO entities (canonical_name, entity_type, aliases, status)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [canonical_name, entity_type, aliases || null, status || "promoted"]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error("Error creating entity:", error);
    return NextResponse.json(
      { error: "Failed to create entity" },
      { status: 500 }
    );
  }
}
