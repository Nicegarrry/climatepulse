import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT tc.*,
        sd.name as source_domain_name, td.name as target_domain_name
      FROM transmission_channels tc
      LEFT JOIN taxonomy_domains sd ON sd.id = tc.source_domain_id
      LEFT JOIN taxonomy_domains td ON td.id = tc.target_domain_id
      ORDER BY tc.created_at DESC
    `);

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("Error fetching channels:", error);
    return NextResponse.json(
      { error: "Failed to fetch channels" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { source_domain_id, target_domain_id, label, description, mechanism, strength } = body;

    const result = await pool.query(
      `INSERT INTO transmission_channels (source_domain_id, target_domain_id, label, description, mechanism, strength)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [source_domain_id, target_domain_id, label, description || null, mechanism || null, strength || null]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error("Error creating channel:", error);
    return NextResponse.json(
      { error: "Failed to create channel" },
      { status: 500 }
    );
  }
}
