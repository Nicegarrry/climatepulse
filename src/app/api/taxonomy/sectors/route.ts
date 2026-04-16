import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth("admin");
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const domainId = searchParams.get("domain_id");

    let query = "SELECT * FROM taxonomy_sectors";
    const params: any[] = [];

    if (domainId) {
      query += " WHERE domain_id = $1";
      params.push(parseInt(domainId));
    }

    query += " ORDER BY sort_order";

    const result = await pool.query(query, params);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("Error fetching sectors:", error);
    return NextResponse.json(
      { error: "Failed to fetch sectors" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth("admin");
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { domain_id, slug, name, description } = body;

    const result = await pool.query(
      `INSERT INTO taxonomy_sectors (domain_id, slug, name, description)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [domain_id, slug, name, description || null]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error("Error creating sector:", error);
    return NextResponse.json(
      { error: "Failed to create sector" },
      { status: 500 }
    );
  }
}
