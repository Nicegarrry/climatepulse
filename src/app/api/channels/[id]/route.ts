import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/supabase/server";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth("admin");
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    const body = await request.json();
    const { source_domain_id, target_domain_id, label, description, mechanism, strength } = body;

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (source_domain_id !== undefined) {
      fields.push(`source_domain_id = $${idx++}`);
      values.push(source_domain_id);
    }
    if (target_domain_id !== undefined) {
      fields.push(`target_domain_id = $${idx++}`);
      values.push(target_domain_id);
    }
    if (label !== undefined) {
      fields.push(`label = $${idx++}`);
      values.push(label);
    }
    if (description !== undefined) {
      fields.push(`description = $${idx++}`);
      values.push(description);
    }
    if (mechanism !== undefined) {
      fields.push(`mechanism = $${idx++}`);
      values.push(mechanism);
    }
    if (strength !== undefined) {
      fields.push(`strength = $${idx++}`);
      values.push(strength);
    }

    if (fields.length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    values.push(parseInt(id));
    const result = await pool.query(
      `UPDATE transmission_channels SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Channel not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating channel:", error);
    return NextResponse.json(
      { error: "Failed to update channel" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth("admin");
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;

    const result = await pool.query(
      "DELETE FROM transmission_channels WHERE id = $1 RETURNING id",
      [parseInt(id)]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Channel not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting channel:", error);
    return NextResponse.json(
      { error: "Failed to delete channel" },
      { status: 500 }
    );
  }
}
