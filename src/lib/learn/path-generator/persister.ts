import pool from "@/lib/db";
import { randomUUID } from "node:crypto";
import type { Intent, PathPlan } from "./types";

export type UpdatePolicy = "frozen" | "live" | "periodic";

export interface SavePathOptions {
  update_policy?: UpdatePolicy;
  editorial_status?:
    | "editor_authored"
    | "editor_reviewed"
    | "ai_drafted"
    | "user_generated";
  title?: string;
  goal?: string;
  intent?: Intent;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

function buildScope(plan: PathPlan, intent?: Intent): Record<string, unknown> {
  if (!intent) {
    return {
      in_scope_microsectors: [],
      learning_level: "intro",
      orientation: "",
      time_budget: "30m",
      audience_context: "",
    };
  }
  return {
    in_scope_microsectors: intent.in_scope_microsectors,
    learning_level: intent.learning_level,
    orientation: intent.orientation,
    time_budget: intent.time_budget,
    audience_context: intent.audience_context,
  };
}

/**
 * Persist a PathPlan to learning_paths + learning_path_items (transactional).
 * Default update_policy='frozen' for user-generated paths (edge-case #5).
 */
export async function savePath(
  plan: PathPlan,
  userId: string,
  opts: SavePathOptions = {},
): Promise<string> {
  const updatePolicy: UpdatePolicy = opts.update_policy ?? "frozen";
  const editorialStatus = opts.editorial_status ?? "user_generated";
  const pathId = randomUUID();
  const baseTitle = opts.title ?? "Learning Path";
  const slug = slugify(baseTitle) + "-" + pathId.slice(0, 8);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO learning_paths
         (id, slug, title, goal, scope, update_policy, intent,
          editorial_status, author_user_id, version, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb, $8, $9, 1, NOW(), NOW())`,
      [
        pathId,
        slug,
        baseTitle,
        opts.goal ?? null,
        JSON.stringify(buildScope(plan, opts.intent)),
        updatePolicy,
        opts.intent ? JSON.stringify(opts.intent) : null,
        editorialStatus,
        userId,
      ],
    );

    if (plan.items.length > 0) {
      const valuePhs: string[] = [];
      const params: unknown[] = [];
      let i = 1;
      for (const item of plan.items) {
        valuePhs.push(
          `($${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, NOW())`,
        );
        params.push(
          randomUUID(),
          pathId,
          item.position,
          item.chapter,
          item.item_type,
          item.item_id,
          item.item_version ?? null,
          item.completion_required,
          item.note ?? null,
        );
      }
      await client.query(
        `INSERT INTO learning_path_items
           (id, path_id, position, chapter, item_type, item_id,
            item_version, completion_required, note, created_at)
         VALUES ${valuePhs.join(", ")}`,
        params,
      );
    }

    await client.query("COMMIT");
    return pathId;
  } catch (err) {
    await client.query("ROLLBACK");
    throw new Error(`[persister] save failed: ${String(err)}`);
  } finally {
    client.release();
  }
}
