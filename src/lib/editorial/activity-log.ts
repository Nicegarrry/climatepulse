import pool from "@/lib/db";

export type ActivityTargetType =
  | "daily_briefing"
  | "weekly_digest"
  | "source"
  | "assignment";

export type ActivityAction =
  | "pick_toggled"
  | "note_edited"
  | "suppressed"
  | "unsuppressed"
  | "analysis_edited"
  | "intro_edited"
  | "reordered"
  | "sector_retagged"
  | "story_injected"
  | "regenerated"
  | "published"
  | "scheduled"
  | "unscheduled"
  | "assignment_created"
  | "assignment_revoked";

export interface LogActivityInput {
  actorUserId: string;
  targetType: ActivityTargetType;
  targetId: string;
  action: ActivityAction;
  payload?: Record<string, unknown>;
}

export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO editorial_activity_log
         (actor_user_id, target_type, target_id, action, payload)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [
        input.actorUserId,
        input.targetType,
        input.targetId,
        input.action,
        JSON.stringify(input.payload ?? {}),
      ]
    );
  } catch (err) {
    console.error("[activity-log] write failed:", err);
  }
}

export interface ActivityEntry {
  id: string;
  actor_user_id: string;
  actor_name: string | null;
  target_type: ActivityTargetType;
  target_id: string;
  action: ActivityAction;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface FetchActivityOptions {
  since?: Date;
  until?: Date;
  targetType?: ActivityTargetType;
  targetId?: string;
  actorUserId?: string;
  limit?: number;
}

export async function fetchActivity(
  opts: FetchActivityOptions = {}
): Promise<ActivityEntry[]> {
  const conds: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  if (opts.since) {
    conds.push(`l.created_at >= $${i++}`);
    vals.push(opts.since.toISOString());
  }
  if (opts.until) {
    conds.push(`l.created_at < $${i++}`);
    vals.push(opts.until.toISOString());
  }
  if (opts.targetType) {
    conds.push(`l.target_type = $${i++}`);
    vals.push(opts.targetType);
  }
  if (opts.targetId) {
    conds.push(`l.target_id = $${i++}`);
    vals.push(opts.targetId);
  }
  if (opts.actorUserId) {
    conds.push(`l.actor_user_id = $${i++}`);
    vals.push(opts.actorUserId);
  }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const limit = Math.max(1, Math.min(500, opts.limit ?? 200));

  const { rows } = await pool.query(
    `SELECT l.id::text AS id,
            l.actor_user_id,
            p.name AS actor_name,
            l.target_type,
            l.target_id,
            l.action,
            l.payload,
            l.created_at
       FROM editorial_activity_log l
       LEFT JOIN user_profiles p ON p.id = l.actor_user_id
       ${where}
      ORDER BY l.created_at DESC
      LIMIT ${limit}`,
    vals
  );
  return rows as ActivityEntry[];
}
