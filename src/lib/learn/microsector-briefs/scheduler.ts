import pool from "@/lib/db";
import { generateBlock } from "./block-generator";
import { deriveRelatedForBrief } from "./related-derivation";
import {
  BlockType,
  CadencePolicy,
  DEFAULT_CADENCE,
  CADENCE_WINDOW_MS,
} from "./types";

const CONCURRENCY = 3;

// nicks_lens is manual-only; related is SQL-derived (handled after the LLM loop).
const ALL_GENERATED_BLOCK_TYPES: BlockType[] = (
  Object.values(BlockType) as BlockType[]
).filter(
  (bt) => bt !== BlockType.NicksLens && bt !== BlockType.Related,
);

interface SchedulerOpts {
  blockTypeFilter?: BlockType;
  microsectorSlug?: string;
  dryRun?: boolean;
}

interface SchedulerResult {
  attempted: number;
  skipped: number;
  generated: number;
  failed: number;
}

/**
 * Iterate briefs × generated block types; enqueue blocks due for refresh
 * per cadence policy. Concurrency 3. LEARN_GENERATION_ENABLED-gated.
 */
export async function scheduleRefresh(
  opts: SchedulerOpts = {},
): Promise<SchedulerResult> {
  if (process.env.LEARN_GENERATION_ENABLED !== "true") {
    console.log("[scheduler] LEARN_GENERATION_ENABLED is not 'true' — aborting");
    return { attempted: 0, skipped: 0, generated: 0, failed: 0 };
  }

  const blockTypes = opts.blockTypeFilter
    ? [opts.blockTypeFilter]
    : ALL_GENERATED_BLOCK_TYPES;

  const briefsQuery = opts.microsectorSlug
    ? `SELECT mb.id, mb.microsector_id, tm.slug AS microsector_slug,
              tm.name AS microsector_name, mb.primary_domain
         FROM microsector_briefs mb
         JOIN taxonomy_microsectors tm ON tm.id = mb.microsector_id
         WHERE tm.slug = $1 AND tm.deprecated_at IS NULL`
    : `SELECT mb.id, mb.microsector_id, tm.slug AS microsector_slug,
              tm.name AS microsector_name, mb.primary_domain
         FROM microsector_briefs mb
         JOIN taxonomy_microsectors tm ON tm.id = mb.microsector_id
         WHERE tm.deprecated_at IS NULL`;
  const briefParams = opts.microsectorSlug ? [opts.microsectorSlug] : [];

  const { rows: briefs } = await pool.query<{
    id: string;
    microsector_id: number;
    microsector_slug: string;
    microsector_name: string;
    primary_domain: string | null;
  }>(briefsQuery, briefParams);

  if (briefs.length === 0) {
    return { attempted: 0, skipped: 0, generated: 0, failed: 0 };
  }

  const briefIds = briefs.map((b) => b.id);
  const { rows: existingBlocks } = await pool.query<{
    brief_id: string;
    block_type: BlockType;
    cadence_policy: CadencePolicy;
    last_generated_at: Date | null;
  }>(
    `SELECT brief_id, block_type, cadence_policy, last_generated_at
       FROM microsector_brief_blocks
       WHERE brief_id = ANY($1)`,
    [briefIds],
  );

  const blockState = new Map<
    string,
    { cadencePolicy: CadencePolicy; lastGeneratedAt: Date | null }
  >();
  for (const b of existingBlocks) {
    blockState.set(`${b.brief_id}:${b.block_type}`, {
      cadencePolicy: b.cadence_policy,
      lastGeneratedAt: b.last_generated_at,
    });
  }

  const queue: Array<{ brief: typeof briefs[number]; blockType: BlockType }> = [];
  const now = Date.now();

  for (const brief of briefs) {
    for (const blockType of blockTypes) {
      const state = blockState.get(`${brief.id}:${blockType}`);
      const cadence = state?.cadencePolicy ?? DEFAULT_CADENCE[blockType];
      const windowMs = CADENCE_WINDOW_MS[cadence];
      if (windowMs === Infinity) continue;

      const lastGen = state?.lastGeneratedAt;
      const isDue = !lastGen || now - lastGen.getTime() >= windowMs;
      if (isDue) queue.push({ brief, blockType });
    }
  }

  const result: SchedulerResult = {
    attempted: queue.length,
    skipped: 0,
    generated: 0,
    failed: 0,
  };

  if (opts.dryRun) {
    console.log(
      `[scheduler] dry-run: ${queue.length} due`,
      queue.map((q) => `${q.brief.microsector_slug}:${q.blockType}`),
    );
    return result;
  }

  for (let i = 0; i < queue.length; i += CONCURRENCY) {
    const batch = queue.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async ({ brief, blockType }) => {
        try {
          const { rows: articles } = await pool.query<{
            id: string;
            content_hash: string;
          }>(
            `SELECT ea.id,
                    md5(COALESCE(ea.signal_type, '') ||
                        COALESCE(ea.sentiment, '') ||
                        COALESCE(ra.title, '')) AS content_hash
               FROM enriched_articles ea
               JOIN raw_articles ra ON ra.id = ea.raw_article_id
               WHERE $1 = ANY(ea.microsector_ids)
               ORDER BY ra.published_at DESC NULLS LAST
               LIMIT 100`,
            [brief.microsector_id],
          );

          const res = await generateBlock(brief.id, blockType, {
            microsectorSlug: brief.microsector_slug,
            microsectorName: brief.microsector_name,
            primaryDomain: brief.primary_domain,
            articles,
          });

          if ("skipped" in res) result.skipped++;
          else result.generated++;
        } catch (err) {
          result.failed++;
          console.error(
            `[scheduler] ${brief.microsector_slug}:${blockType} failed:`,
            err,
          );
        }
      }),
    );
  }

  // Related blocks are SQL-derived. Check quarterly due-ness per-brief and refresh.
  if (!opts.blockTypeFilter || opts.blockTypeFilter === BlockType.Related) {
    const relatedWindowMs =
      CADENCE_WINDOW_MS[DEFAULT_CADENCE[BlockType.Related]];
    for (const brief of briefs) {
      const state = blockState.get(`${brief.id}:${BlockType.Related}`);
      const lastGen = state?.lastGeneratedAt;
      const isDue = !lastGen || now - lastGen.getTime() >= relatedWindowMs;
      if (!isDue) continue;

      result.attempted++;
      try {
        await deriveRelatedForBrief(brief.id, brief.microsector_id);
        result.generated++;
      } catch (err) {
        result.failed++;
        console.error(
          `[scheduler] ${brief.microsector_slug}:related failed:`,
          err,
        );
      }
    }
  }

  return result;
}
