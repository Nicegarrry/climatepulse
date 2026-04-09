import pool from "@/lib/db";
import { GEMINI_MODEL } from "@/lib/ai-models";
import { prefetchFullText } from "@/lib/enrichment/fulltext-prefetch";
import { classifyBatch } from "@/lib/enrichment/stage1-classifier";
import { enrichArticle, computeComposite } from "@/lib/enrichment/stage2-enricher";
import { resolveEntities, promoteEligibleEntities, markDormantEntities, archiveStaleCandidates } from "@/lib/enrichment/entity-resolver";
import { getAllMicrosectors } from "@/lib/enrichment/taxonomy-cache";
import { discoverStorylines } from "@/lib/enrichment/storyline-discovery";
import type {
  RawArticle,
  Stage1Result,
  EnrichmentBatchResult,
} from "@/lib/types";

const STAGE1_BATCH_SIZE = 10;
const STAGE2_CONCURRENCY = 3;

interface ArticleRow extends RawArticle {
  full_text: string | null;
  full_text_word_count: number | null;
}

/**
 * Run a concurrency-limited set of async operations.
 */
async function withConcurrency<T>(
  items: T[],
  fn: (item: T) => Promise<void>,
  limit: number
): Promise<void> {
  const queue = [...items];
  const running: Promise<void>[] = [];

  while (queue.length > 0 || running.length > 0) {
    while (running.length < limit && queue.length > 0) {
      const item = queue.shift()!;
      const promise = fn(item).then(() => {
        running.splice(running.indexOf(promise), 1);
      });
      running.push(promise);
    }
    if (running.length > 0) {
      await Promise.race(running);
    }
  }
}

/**
 * Run one batch through the two-stage enrichment pipeline:
 * 1. Prefetch full text for articles that need it
 * 2. Stage 1: Classify batch of up to 10 articles (one Gemini call)
 * 3. Stage 2: Enrich each article individually (domain-filtered, with significance scoring)
 * 4. Write results to database
 * 5. Promote eligible candidate entities
 */
export async function runEnrichmentBatch(
  opts?: { reenrich?: boolean }
): Promise<
  EnrichmentBatchResult & { fulltext_fetched: number; entities_promoted: number; entities_dormant: number; entities_archived: number }
> {
  const start = Date.now();
  const reenrich = opts?.reenrich ?? false;

  // Step 1: Prefetch full text
  const fulltextResult = await prefetchFullText(50);

  // Step 2: Fetch articles to process
  const whereClause = reenrich
    ? `WHERE ea.id IS NULL OR ea.pipeline_version < 4`
    : `WHERE ea.id IS NULL`;

  const { rows: articles } = await pool.query<ArticleRow>(
    `SELECT ra.*, ft.content as full_text, ft.word_count as full_text_word_count
     FROM raw_articles ra
     LEFT JOIN enriched_articles ea ON ea.raw_article_id = ra.id
     LEFT JOIN full_text_articles ft ON ft.raw_article_id = ra.id
     ${whereClause}
     ORDER BY ra.fetched_at DESC
     LIMIT $1`,
    [STAGE1_BATCH_SIZE]
  );

  // Count total remaining
  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*) as count FROM raw_articles ra
     LEFT JOIN enriched_articles ea ON ea.raw_article_id = ra.id
     ${whereClause}`
  );
  const totalRemaining = parseInt(countRows[0].count);

  if (articles.length === 0) {
    return {
      articles_processed: 0,
      errors: 0,
      duration_ms: Date.now() - start,
      input_tokens: 0,
      output_tokens: 0,
      estimated_cost_usd: 0,
      total_remaining: 0,
      total_batches_remaining: 0,
      done: true,
      entities_created: 0,
      entities_matched: 0,
      stage1_duration_ms: 0,
      stage2_duration_ms: 0,
      pipeline_version: 2,
      fulltext_fetched: fulltextResult.fetched,
      entities_promoted: 0,
      entities_dormant: 0,
      entities_archived: 0,
    };
  }

  // Step 3: Stage 1 — Classify batch
  const stage1Start = Date.now();
  const stage1 = await classifyBatch(articles);
  const stage1DurationMs = Date.now() - stage1Start;

  // Build lookup: article ID -> classification
  const classificationMap = new Map<string, Stage1Result>();
  for (const r of stage1.results) {
    classificationMap.set(r.raw_article_id, r);
  }

  // Step 4: Stage 2 — Enrich each article individually
  const stage2Start = Date.now();
  let totalInputTokens = stage1.inputTokens;
  let totalOutputTokens = stage1.outputTokens;
  let processed = 0;
  let errors = 0;
  let entitiesCreated = 0;
  let entitiesMatched = 0;
  const enrichedArticleIds: string[] = [];

  // Load microsector slug->id mapping
  const allMicrosectors = await getAllMicrosectors();
  const slugToId = new Map(allMicrosectors.map((m) => [m.slug, m.id]));

  await withConcurrency(
    articles,
    async (article) => {
      const classification = classificationMap.get(article.id);
      if (!classification) {
        errors++;
        return;
      }

      try {
        const { result, inputTokens, outputTokens } = await enrichArticle(
          article,
          classification
        );
        totalInputTokens += inputTokens;
        totalOutputTokens += outputTokens;

        // Resolve microsector slugs to IDs
        const microsectorIds = result.microsectors
          .map((m) => slugToId.get(m.slug))
          .filter((id): id is number => id != null);

        // Build confidence levels map
        const confidenceLevels: Record<string, string> = {};
        for (const m of result.microsectors) {
          confidenceLevels[m.slug] = m.confidence;
        }

        // Compute composite significance score
        const composite = computeComposite(result.significance);

        // Resolve entities
        const resolvedEntities = await resolveEntities(result.entities);
        for (const re of resolvedEntities) {
          if (re.created) entitiesCreated++;
          else entitiesMatched++;
        }

        // UPSERT into enriched_articles
        const { rows: enrichedRows } = await pool.query<{ id: string }>(
          `INSERT INTO enriched_articles (
            raw_article_id, microsector_ids, tag_ids, signal_type, sentiment,
            jurisdictions, raw_entities, model_used, used_full_text,
            significance_scores, significance_composite, context_quality,
            primary_domain, secondary_domain, confidence_levels,
            quantitative_data, transmission_channels_triggered,
            regulations_referenced, technologies_referenced, pipeline_version
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
          ON CONFLICT (raw_article_id) DO UPDATE SET
            microsector_ids = EXCLUDED.microsector_ids,
            tag_ids = EXCLUDED.tag_ids,
            signal_type = EXCLUDED.signal_type,
            sentiment = EXCLUDED.sentiment,
            jurisdictions = EXCLUDED.jurisdictions,
            raw_entities = EXCLUDED.raw_entities,
            model_used = EXCLUDED.model_used,
            used_full_text = EXCLUDED.used_full_text,
            significance_scores = EXCLUDED.significance_scores,
            significance_composite = EXCLUDED.significance_composite,
            context_quality = EXCLUDED.context_quality,
            primary_domain = EXCLUDED.primary_domain,
            secondary_domain = EXCLUDED.secondary_domain,
            confidence_levels = EXCLUDED.confidence_levels,
            quantitative_data = EXCLUDED.quantitative_data,
            transmission_channels_triggered = EXCLUDED.transmission_channels_triggered,
            regulations_referenced = EXCLUDED.regulations_referenced,
            technologies_referenced = EXCLUDED.technologies_referenced,
            pipeline_version = EXCLUDED.pipeline_version,
            enriched_at = NOW()
          RETURNING id`,
          [
            article.id,
            microsectorIds,
            [], // tag_ids — not populated yet
            classification.signal_type,
            result.sentiment, // sentiment — extracted from Stage 2 AI response
            result.jurisdictions,
            JSON.stringify(result.entities),
            GEMINI_MODEL,
            !!article.full_text,
            JSON.stringify(result.significance),
            composite,
            classification.context_quality,
            classification.primary_domain,
            classification.secondary_domain,
            JSON.stringify(confidenceLevels),
            result.quantitative_data ? JSON.stringify(result.quantitative_data) : null,
            result.transmission_channels_triggered,
            result.regulations_referenced,
            result.technologies_referenced,
            4, // pipeline_version — v4 sentiment + channels + storylines
          ]
        );

        if (enrichedRows.length > 0) {
          const enrichedId = enrichedRows[0].id;
          enrichedArticleIds.push(enrichedId);

          // Delete old article_entities for re-enrichment
          if (reenrich) {
            await pool.query(
              `DELETE FROM article_entities WHERE enriched_article_id = $1`,
              [enrichedId]
            );
          }

          // INSERT article_entities with context
          for (let i = 0; i < resolvedEntities.length; i++) {
            const entityMention = result.entities[i];
            const resolved = resolvedEntities[i];
            if (!entityMention || !resolved) continue;

            await pool.query(
              `INSERT INTO article_entities (enriched_article_id, entity_id, role, context)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (enriched_article_id, entity_id) DO UPDATE SET
                 context = EXCLUDED.context`,
              [enrichedId, resolved.entityId, resolved.role, entityMention.context || null]
            );
          }

          processed++;
        }
      } catch (err) {
        console.error(`Stage 2 error for article ${article.id}:`, err);
        errors++;
      }
    },
    STAGE2_CONCURRENCY
  );

  const stage2DurationMs = Date.now() - stage2Start;

  // Step 5: Promote entities and mark dormant
  const entitiesPromoted = await promoteEligibleEntities();
  const entitiesDormant = await markDormantEntities();
  const entitiesArchived = await archiveStaleCandidates();
  if (entitiesArchived > 0) {
    console.log(`Archived ${entitiesArchived} stale candidate entities`);
  }

  // Step 6: Storyline discovery
  let storylinesMatched = 0;
  let storylinesSuggested = 0;
  try {
    const storylineResult = await discoverStorylines(enrichedArticleIds);
    storylinesMatched = storylineResult.matched;
    storylinesSuggested = storylineResult.suggested;
    if (storylinesMatched > 0 || storylinesSuggested > 0) {
      console.log(`Storylines: ${storylinesMatched} matched, ${storylinesSuggested} suggested`);
    }
  } catch (err) {
    console.error("Storyline discovery failed:", err);
  }

  // Cost calculation
  const estimatedCost =
    (totalInputTokens * 0.15) / 1_000_000 +
    (totalOutputTokens * 0.6) / 1_000_000;

  const remainingAfter = totalRemaining - processed;

  return {
    articles_processed: processed,
    errors,
    duration_ms: Date.now() - start,
    input_tokens: totalInputTokens,
    output_tokens: totalOutputTokens,
    estimated_cost_usd: estimatedCost,
    total_remaining: remainingAfter,
    total_batches_remaining: Math.ceil(remainingAfter / STAGE1_BATCH_SIZE),
    done: remainingAfter <= 0,
    entities_created: entitiesCreated,
    entities_matched: entitiesMatched,
    stage1_duration_ms: stage1DurationMs,
    stage2_duration_ms: stage2DurationMs,
    pipeline_version: 2,
    fulltext_fetched: fulltextResult.fetched,
    entities_promoted: entitiesPromoted,
    entities_dormant: entitiesDormant,
    entities_archived: entitiesArchived,
  };
}
