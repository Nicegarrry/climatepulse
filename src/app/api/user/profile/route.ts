import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getAuthUser } from "@/lib/supabase/server";
import type { UserProfile } from "@/lib/types";

// ─── GET — fetch user profile ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    // Special handling: profile may not exist yet during onboarding.
    // Use getAuthUser instead of requireAuth so we can return 404 for new users.
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const requestedUserId = req.nextUrl.searchParams.get("userId");
    if (requestedUserId && requestedUserId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const userId = requestedUserId || user.id;

    // Query with user_role + notification_prefs (columns may not exist in older DBs).
    // Fall back progressively: first drop notification_prefs, then drop user_role.
    let result;
    try {
      result = await pool.query(
        `SELECT id, name, email, role_lens, primary_sectors, jurisdictions,
                followed_entities, followed_storylines, triage_history,
                accordion_opens, story_ring_taps, briefing_depth, digest_time,
                onboarded_at, user_role, notification_prefs
         FROM user_profiles WHERE id = $1`,
        [userId]
      );
    } catch {
      try {
        // Fallback: drop notification_prefs if that column is missing
        result = await pool.query(
          `SELECT id, name, email, role_lens, primary_sectors, jurisdictions,
                  followed_entities, followed_storylines, triage_history,
                  accordion_opens, story_ring_taps, briefing_depth, digest_time,
                  onboarded_at, user_role
           FROM user_profiles WHERE id = $1`,
          [userId]
        );
      } catch {
        // Fallback: drop both user_role and notification_prefs
        result = await pool.query(
          `SELECT id, name, email, role_lens, primary_sectors, jurisdictions,
                  followed_entities, followed_storylines, triage_history,
                  accordion_opens, story_ring_taps, briefing_depth, digest_time,
                  onboarded_at
           FROM user_profiles WHERE id = $1`,
          [userId]
        );
      }
    }

    if (result.rows.length === 0) {
      // No profile yet — trigger onboarding flow
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const row = result.rows[0];

    const DEFAULT_NOTIFICATION_PREFS = {
      daily_briefing: true,
      weekly_digest: true,
      high_priority_alerts: false,
      entity_updates: false,
    };

    const profile: UserProfile & {
      onboarded_at: string | null;
      user_role: string;
      notification_prefs: Record<string, boolean>;
    } = {
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
      onboarded_at: row.onboarded_at ?? null,
      user_role: row.user_role ?? "reader",
      notification_prefs: {
        ...DEFAULT_NOTIFICATION_PREFS,
        ...(row.notification_prefs ?? {}),
      },
    };

    return NextResponse.json(profile);
  } catch (err) {
    console.error("Profile fetch error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// ─── PUT — update or upsert user profile ──────────────────────────────────
// Used by onboarding flow — creates profile on first call, updates thereafter.

export async function PUT(req: NextRequest) {
  try {
    // Auth check: users can only modify their own profile.
    // Onboarding case is allowed because profile may not exist yet.
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const userId = body.userId;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    if (userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if profile exists
    const existing = await pool.query(
      "SELECT id FROM user_profiles WHERE id = $1",
      [userId]
    );

    if (existing.rows.length === 0) {
      // Upsert: create profile for first-time onboarding
      // Default user_role = 'reader'; name/email come from auth
      const email = body.email || `${userId}@placeholder.local`;
      const name = body.name || email.split("@")[0];

      await pool.query(
        `INSERT INTO user_profiles (
          id, name, email, role_lens, primary_sectors, jurisdictions,
          briefing_depth, onboarded_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          userId,
          name,
          email,
          body.role_lens || "general",
          body.primary_sectors || [],
          body.jurisdictions || ["australia"],
          body.briefing_depth || "standard",
          body.onboarded_at || new Date().toISOString(),
        ]
      );

      return NextResponse.json({ ok: true, created: true });
    }

    // Update path
    const allowedFields = [
      "role_lens",
      "primary_sectors",
      "jurisdictions",
      "followed_entities",
      "followed_storylines",
      "briefing_depth",
      "digest_time",
      "onboarded_at",
      "name",
      "notification_prefs",
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
    values.push(userId);

    try {
      await pool.query(
        `UPDATE user_profiles SET ${updates.join(", ")} WHERE id = $${paramIndex}`,
        values
      );
    } catch (err) {
      // Retry without notification_prefs if that column doesn't exist on this DB
      const message = err instanceof Error ? err.message : "";
      if (message.includes("notification_prefs") && "notification_prefs" in body) {
        const filteredFields = allowedFields.filter((f) => f !== "notification_prefs");
        const filteredUpdates: string[] = [];
        const filteredValues: unknown[] = [];
        let idx = 1;
        for (const field of filteredFields) {
          if (field in body) {
            filteredUpdates.push(`${field} = $${idx}`);
            filteredValues.push(body[field]);
            idx++;
          }
        }
        if (filteredUpdates.length === 0) {
          return NextResponse.json({ ok: true, skipped: "notification_prefs" });
        }
        filteredUpdates.push(`updated_at = NOW()`);
        filteredValues.push(userId);
        await pool.query(
          `UPDATE user_profiles SET ${filteredUpdates.join(", ")} WHERE id = $${idx}`,
          filteredValues
        );
      } else {
        throw err;
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Profile update error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// ─── POST — create new user profile (onboarding) ─────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, role_lens, primary_sectors, jurisdictions, briefing_depth } = body;

    if (!name || !email) {
      return NextResponse.json(
        { error: "name and email are required" },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `INSERT INTO user_profiles (name, email, role_lens, primary_sectors, jurisdictions, briefing_depth, onboarded_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (email) DO UPDATE SET
         role_lens = EXCLUDED.role_lens,
         primary_sectors = EXCLUDED.primary_sectors,
         jurisdictions = EXCLUDED.jurisdictions,
         briefing_depth = EXCLUDED.briefing_depth,
         onboarded_at = COALESCE(user_profiles.onboarded_at, NOW()),
         updated_at = NOW()
       RETURNING id, name, email, role_lens, primary_sectors, jurisdictions, briefing_depth, onboarded_at`,
      [
        name,
        email,
        role_lens || "general",
        primary_sectors || [],
        jurisdictions || ["australia"],
        briefing_depth || "standard",
      ]
    );

    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error("Profile create error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
