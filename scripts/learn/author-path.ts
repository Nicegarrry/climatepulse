/**
 * CLI: node --env-file=.env.local --experimental-strip-types scripts/learn/author-path.ts --file <path> [--reviewer <user_id>]
 *
 * Editor-authored learning path. Reads a JSON file defining the path metadata
 * + items, resolves item references by slug (for ergonomics), and persists
 * via savePath() with editorial_status='editor_authored'.
 *
 * Expected JSON shape:
 *   {
 *     "title": "Australian Electricity Markets",
 *     "slug": "au-electricity-markets",          // optional — derived from title if absent
 *     "goal": "…",                                 // optional
 *     "update_policy": "live" | "frozen" | "periodic", // default 'live' for editor-authored
 *     "author_user_id": "<user_profiles.id>",    // required
 *     "reviewer_user_id": "<user_profiles.id>",  // optional; sets reviewed_by
 *     "scope": {
 *       "in_scope_microsectors": [<int>, …] OR ["<microsector_slug>", …],
 *       "learning_level": "intro"|"intermediate"|"advanced",
 *       "orientation": "…",
 *       "time_budget": "15m"|"30m"|"1h"|"2h"|"half_day"|"full_day",
 *       "audience_context": "…"
 *     },
 *     "items": [
 *       {"item_type": "concept_card", "slug": "marginal-loss-factor", "chapter": "Foundations", "position": 0, "note": "…"},
 *       {"item_type": "microsector_brief", "slug": "energy-grid", "chapter": "Current state", "position": 1},
 *       {"item_type": "microsector_brief_block", "microsector_slug": "energy-grid", "block_type": "current_state", "chapter": "Current state", "position": 2}
 *     ]
 *   }
 *
 * Concept_card + microsector_brief_block items get version pinned to the
 * current version at author time (constraint: lpi_version_pin_required).
 */
import fs from "node:fs";
import path from "node:path";
import pool from "../../src/lib/db";
import type {
  PathItem,
  PathPlan,
  Intent,
} from "../../src/lib/learn/path-generator/types";

const args = process.argv.slice(2);
const fileIdx = args.indexOf("--file");
const filePath = fileIdx !== -1 ? args[fileIdx + 1] : undefined;

const reviewerIdx = args.indexOf("--reviewer");
const reviewerArg = reviewerIdx !== -1 ? args[reviewerIdx + 1] : undefined;

if (!filePath) {
  console.error(
    "Usage: author-path.ts --file <path-to-json> [--reviewer <user_id>]",
  );
  process.exit(1);
}

interface AuthorItemInput {
  item_type: "concept_card" | "microsector_brief" | "microsector_brief_block" | "briefing" | "deep_dive" | "podcast" | "quiz";
  slug?: string;
  microsector_slug?: string;
  block_type?: string;
  item_id?: string;
  chapter: string;
  position: number;
  note?: string | null;
  completion_required?: boolean;
}

interface AuthorPathInput {
  title: string;
  slug?: string;
  goal?: string;
  update_policy?: "live" | "frozen" | "periodic";
  author_user_id: string;
  reviewer_user_id?: string;
  scope: {
    in_scope_microsectors: (number | string)[];
    learning_level: Intent["learning_level"];
    orientation: string;
    time_budget: Intent["time_budget"];
    audience_context: string;
  };
  items: AuthorItemInput[];
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

async function resolveMicrosectorIds(
  refs: (number | string)[],
): Promise<number[]> {
  const numeric = refs.filter((r): r is number => typeof r === "number");
  const slugs = refs.filter((r): r is string => typeof r === "string");
  if (slugs.length === 0) return numeric;
  const { rows } = await pool.query<{ id: number; slug: string }>(
    `SELECT id, slug FROM taxonomy_microsectors WHERE slug = ANY($1)`,
    [slugs],
  );
  const map = new Map(rows.map((r) => [r.slug, r.id]));
  const missing = slugs.filter((s) => !map.has(s));
  if (missing.length > 0) {
    throw new Error(`Unknown microsector slug(s): ${missing.join(", ")}`);
  }
  return [...numeric, ...slugs.map((s) => map.get(s)!)];
}

async function resolveItem(
  input: AuthorItemInput,
): Promise<PathItem> {
  const { item_type, chapter, position, note, completion_required } = input;
  const base = {
    item_type,
    chapter,
    position,
    note: note ?? undefined,
    completion_required: completion_required ?? true,
  };

  if (input.item_id) {
    return { ...base, item_id: input.item_id };
  }

  if (item_type === "concept_card") {
    if (!input.slug) throw new Error(`concept_card item at position ${position} needs "slug" or "item_id"`);
    const { rows } = await pool.query<{ id: string; version: number }>(
      `SELECT id, version FROM concept_cards
         WHERE slug = $1 AND superseded_by IS NULL
         ORDER BY updated_at DESC LIMIT 1`,
      [input.slug],
    );
    if (rows.length === 0) {
      throw new Error(`concept_card not found: slug="${input.slug}"`);
    }
    return { ...base, item_id: rows[0].id, item_version: rows[0].version };
  }

  if (item_type === "microsector_brief") {
    if (!input.slug) throw new Error(`microsector_brief item at position ${position} needs "slug" or "item_id"`);
    const { rows } = await pool.query<{ id: string }>(
      `SELECT mb.id FROM microsector_briefs mb
         JOIN taxonomy_microsectors tm ON tm.id = mb.microsector_id
        WHERE tm.slug = $1 AND tm.deprecated_at IS NULL`,
      [input.slug],
    );
    if (rows.length === 0) {
      throw new Error(`microsector_brief not found: slug="${input.slug}"`);
    }
    return { ...base, item_id: rows[0].id };
  }

  if (item_type === "microsector_brief_block") {
    if (!input.microsector_slug || !input.block_type) {
      throw new Error(
        `microsector_brief_block item at position ${position} needs "microsector_slug" + "block_type"`,
      );
    }
    const { rows } = await pool.query<{ id: string; version: number }>(
      `SELECT mbb.id, mbb.version
         FROM microsector_brief_blocks mbb
         JOIN microsector_briefs mb ON mb.id = mbb.brief_id
         JOIN taxonomy_microsectors tm ON tm.id = mb.microsector_id
        WHERE tm.slug = $1 AND mbb.block_type = $2`,
      [input.microsector_slug, input.block_type],
    );
    if (rows.length === 0) {
      throw new Error(
        `microsector_brief_block not found: ${input.microsector_slug}/${input.block_type}`,
      );
    }
    return { ...base, item_id: rows[0].id, item_version: rows[0].version };
  }

  throw new Error(
    `Unsupported item_type for slug-based resolution: ${item_type}. Supply "item_id" explicitly.`,
  );
}

(async () => {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    console.error(`[author-path] file not found: ${resolved}`);
    process.exit(1);
  }

  const input = JSON.parse(fs.readFileSync(resolved, "utf-8")) as AuthorPathInput;

  if (!input.title || !input.author_user_id) {
    console.error("[author-path] input must include title + author_user_id");
    process.exit(1);
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    console.error("[author-path] input.items must be a non-empty array");
    process.exit(1);
  }

  const pathSlug = input.slug ?? slugify(input.title);
  const existing = await pool.query<{ id: string }>(
    `SELECT id FROM learning_paths WHERE slug = $1`,
    [pathSlug],
  );
  if (existing.rows.length > 0) {
    console.error(
      `[author-path] a path with slug="${pathSlug}" already exists (id=${existing.rows[0].id}). Rename or delete first.`,
    );
    process.exit(1);
  }

  const microsectorIds = await resolveMicrosectorIds(
    input.scope.in_scope_microsectors,
  );
  const intent: Intent = {
    in_scope_microsectors: microsectorIds,
    learning_level: input.scope.learning_level,
    orientation: input.scope.orientation,
    time_budget: input.scope.time_budget,
    audience_context: input.scope.audience_context,
  };

  const resolvedItems: PathItem[] = [];
  for (const item of input.items) {
    resolvedItems.push(await resolveItem(item));
  }

  const chapters = Array.from(
    new Map(
      resolvedItems.map((i) => [i.chapter, { label: i.chapter, position: i.position }]),
    ).values(),
  ).sort((a, b) => a.position - b.position);

  const plan: PathPlan = { items: resolvedItems, chapters };

  const updatePolicy = input.update_policy ?? "live";
  const pathId = await insertPath(plan, {
    title: input.title,
    slug: pathSlug,
    goal: input.goal,
    update_policy: updatePolicy,
    author_user_id: input.author_user_id,
    reviewer_user_id: reviewerArg ?? input.reviewer_user_id,
    intent,
  });

  console.log(
    `[author-path] inserted learning_paths.id=${pathId} slug="${pathSlug}" items=${plan.items.length}`,
  );
  process.exit(0);
})().catch((err) => {
  console.error("[author-path] fatal:", err);
  process.exit(1);
});

async function insertPath(
  plan: PathPlan,
  meta: {
    title: string;
    slug: string;
    goal?: string;
    update_policy: "live" | "frozen" | "periodic";
    author_user_id: string;
    reviewer_user_id?: string;
    intent: Intent;
  },
): Promise<string> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO learning_paths
         (slug, title, goal, scope, update_policy, intent,
          editorial_status, author_user_id, reviewed_by, reviewed_at, version)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6::jsonb,
               'editor_authored', $7, $8, CASE WHEN $8 IS NULL THEN NULL ELSE NOW() END, 1)
       RETURNING id`,
      [
        meta.slug,
        meta.title,
        meta.goal ?? null,
        JSON.stringify({
          in_scope_microsectors: meta.intent.in_scope_microsectors,
          learning_level: meta.intent.learning_level,
          orientation: meta.intent.orientation,
          time_budget: meta.intent.time_budget,
          audience_context: meta.intent.audience_context,
        }),
        meta.update_policy,
        JSON.stringify(meta.intent),
        meta.author_user_id,
        meta.reviewer_user_id ?? null,
      ],
    );
    const pathId = rows[0].id;

    const phs: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    for (const item of plan.items) {
      phs.push(
        `(${[
          `$${i++}`, `$${i++}`, `$${i++}`, `$${i++}`, `$${i++}`,
          `$${i++}`, `$${i++}`, `$${i++}`,
        ].join(", ")}, NOW())`,
      );
      params.push(
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
         (path_id, position, chapter, item_type, item_id,
          item_version, completion_required, note, created_at)
       VALUES ${phs.join(", ")}`,
      params,
    );

    await client.query("COMMIT");
    return pathId;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
