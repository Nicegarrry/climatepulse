import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

// GET /api/weekly/digests/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const { rows } = await pool.query(
      "SELECT * FROM weekly_digests WHERE id = $1",
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Digest not found" }, { status: 404 });
    }

    return NextResponse.json({ digest: rows[0] });
  } catch (err) {
    console.error("weekly digest get:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// PATCH /api/weekly/digests/[id] — update draft fields
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await req.json();
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    const allowedFields = [
      "headline",
      "editor_narrative",
      "weekly_number",
      "curated_stories",
      "theme_commentary",
      "outlook",
      "status",
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        const isJson = ["weekly_number", "curated_stories", "theme_commentary"].includes(field);
        updates.push(`${field} = $${paramIdx}`);
        values.push(isJson ? JSON.stringify(body[field]) : body[field]);
        paramIdx++;
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const { rows } = await pool.query(
      `UPDATE weekly_digests SET ${updates.join(", ")} WHERE id = $${paramIdx} RETURNING *`,
      values
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Digest not found" }, { status: 404 });
    }

    return NextResponse.json({ digest: rows[0] });
  } catch (err) {
    console.error("weekly digest update:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
