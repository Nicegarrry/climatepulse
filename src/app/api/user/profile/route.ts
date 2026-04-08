import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { MOCK_USER_PROFILE } from "@/lib/mock-digest";
import type { UserProfile } from "@/lib/types";

const TEST_USER_ID = "test-user-1";

// ─── GET — fetch user profile ─────────────────────────────────────────────

export async function GET() {
  try {
    const result = await pool.query(
      `SELECT id, name, email, role_lens, primary_sectors, jurisdictions,
              followed_entities, followed_storylines, triage_history,
              accordion_opens, story_ring_taps, briefing_depth, digest_time
       FROM user_profiles WHERE id = $1`,
      [TEST_USER_ID]
    );

    if (result.rows.length === 0) {
      // Fall back to mock profile if table doesn't exist or no row
      return NextResponse.json(MOCK_USER_PROFILE);
    }

    const row = result.rows[0];
    const profile: UserProfile = {
      id: row.id,
      name: row.name,
      email: row.email,
      role_lens: row.role_lens,
      primary_sectors: row.primary_sectors ?? [],
      jurisdictions: row.jurisdictions ?? [],
      followed_entities: row.followed_entities ?? [],
      followed_storylines: row.followed_storylines ?? [],
      triage_history: row.triage_history ?? {},
      accordion_opens: row.accordion_opens ?? {},
      story_ring_taps: row.story_ring_taps ?? {},
      briefing_depth: row.briefing_depth ?? "standard",
      digest_time: row.digest_time ?? "06:30",
    };

    return NextResponse.json(profile);
  } catch {
    // Table might not exist yet — return mock
    return NextResponse.json(MOCK_USER_PROFILE);
  }
}

// ─── PUT — update user profile ────────────────────────────────────────────

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();

    const allowedFields = [
      "role_lens",
      "primary_sectors",
      "jurisdictions",
      "followed_entities",
      "followed_storylines",
      "briefing_depth",
      "digest_time",
    ];

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (field in body) {
        updates.push(`${field} = $${paramIndex}`);
        values.push(body[field]);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    updates.push(`updated_at = NOW()`);
    values.push(TEST_USER_ID);

    await pool.query(
      `UPDATE user_profiles SET ${updates.join(", ")} WHERE id = $${paramIndex}`,
      values
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Profile update error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
