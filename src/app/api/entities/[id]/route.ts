import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const result = await pool.query(
      `SELECT e.*,
        (SELECT COUNT(*) FROM article_entities ae WHERE ae.entity_id = e.id) as linked_article_count
       FROM entities e
       WHERE e.id = $1`,
      [parseInt(id)]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Entity not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching entity:", error);
    return NextResponse.json(
      { error: "Failed to fetch entity" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { canonical_name, aliases, status, metadata } = body;

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (canonical_name !== undefined) {
      fields.push(`canonical_name = $${idx++}`);
      values.push(canonical_name);
    }
    if (aliases !== undefined) {
      fields.push(`aliases = $${idx++}`);
      values.push(aliases);
    }
    if (status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(status);
    }
    if (metadata !== undefined) {
      fields.push(`metadata = $${idx++}`);
      values.push(JSON.stringify(metadata));
    }

    if (fields.length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    values.push(parseInt(id));
    const result = await pool.query(
      `UPDATE entities SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Entity not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating entity:", error);
    return NextResponse.json(
      { error: "Failed to update entity" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const entityId = parseInt(id);

    // Delete from article_entities first
    await pool.query(
      "DELETE FROM article_entities WHERE entity_id = $1",
      [entityId]
    );

    const result = await pool.query(
      "DELETE FROM entities WHERE id = $1 RETURNING id",
      [entityId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Entity not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting entity:", error);
    return NextResponse.json(
      { error: "Failed to delete entity" },
      { status: 500 }
    );
  }
}
