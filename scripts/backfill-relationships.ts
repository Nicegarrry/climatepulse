/**
 * Backfill typed entity-to-entity relationships for the graph-RAG spike.
 *
 * Usage:
 *   GRAPH_EXTRACTION_ENABLED=true npx tsx scripts/backfill-relationships.ts --days 14
 *   GRAPH_EXTRACTION_ENABLED=true npx tsx scripts/backfill-relationships.ts --days 60
 *
 * Per the spike plan: do `--days 14` first, hand-review ~50 sampled triples,
 * then decide whether to do `--days 60` or iterate the prompt.
 *
 * Idempotent: skips enriched_articles that already have at least one row in
 * entity_relationships keyed by source_id = enriched_article_id::text. To
 * force re-extraction, pass `--reextract`.
 *
 * Requires:
 *   DATABASE_URL, GOOGLE_AI_API_KEY in .env.local
 *   GRAPH_EXTRACTION_ENABLED=true (the extractor refuses to run otherwise via
 *   the env-flag check in pipeline.ts; the script ignores that gate because
 *   it calls extractAndStoreRelationships directly)
 */

import { config } from "dotenv";
config({ path: ".env.local" });

interface Args {
  days: number;
  reextract: boolean;
  limit: number | null;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const result: Args = { days: 14, reextract: false, limit: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--days" && args[i + 1]) {
      result.days = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--reextract") {
      result.reextract = true;
    } else if (args[i] === "--limit" && args[i + 1]) {
      result.limit = parseInt(args[i + 1], 10);
      i++;
    }
  }
  return result;
}

async function main() {
  const args = parseArgs();
  console.log(
    `Backfilling relationships for last ${args.days} days` +
      (args.reextract ? " (re-extracting all)" : " (skipping already-processed)") +
      (args.limit ? ` (limit ${args.limit})` : "")
  );

  const { default: pool } = await import("../src/lib/db");
  const { extractAndStoreRelationships } = await import(
    "../src/lib/enrichment/relationship-extractor"
  );

  // Find candidate enriched articles.
  const sql = `
    SELECT
      ea.id           AS enriched_article_id,
      ra.title,
      ra.snippet,
      ft.content      AS full_text
    FROM enriched_articles ea
    JOIN raw_articles ra ON ra.id = ea.raw_article_id
    LEFT JOIN full_text_articles ft ON ft.raw_article_id = ra.id
    WHERE ea.enriched_at >= NOW() - INTERVAL '${args.days} days'
      ${args.reextract ? "" : "AND NOT EXISTS (SELECT 1 FROM entity_relationships er WHERE er.source_type = 'article' AND er.source_id = ea.id::text)"}
      AND EXISTS (
        SELECT 1 FROM article_entities ae
        WHERE ae.enriched_article_id = ea.id
        GROUP BY ae.enriched_article_id
        HAVING COUNT(*) >= 2
      )
    ORDER BY ea.enriched_at DESC
    ${args.limit ? `LIMIT ${args.limit}` : ""}
  `;

  const { rows: articles } = await pool.query<{
    enriched_article_id: string;
    title: string;
    snippet: string | null;
    full_text: string | null;
  }>(sql);

  console.log(`Found ${articles.length} articles to process.\n`);
  if (articles.length === 0) {
    process.exit(0);
  }

  const startTime = Date.now();
  const aggregate = {
    articlesProcessed: 0,
    articlesSkippedNoEntities: 0,
    articlesErrored: 0,
    triplesEmitted: 0,
    triplesStored: 0,
    triplesRejectedLowConfidence: 0,
    triplesRejectedUnresolved: 0,
    triplesRejectedSelf: 0,
    triplesUncategorised: 0,
  };

  for (let i = 0; i < articles.length; i++) {
    const a = articles[i];

    // Build the name→id map from article_entities. We seed the map with both
    // canonical names and aliases — the LLM will see canonical names in the
    // ENTITIES block of the prompt, but it may echo them with minor variation,
    // and matching against aliases catches those cases.
    const { rows: entityRows } = await pool.query<{
      entity_id: number;
      canonical_name: string;
      aliases: string[];
    }>(
      `SELECT ae.entity_id, e.canonical_name, e.aliases
       FROM article_entities ae
       JOIN entities e ON e.id = ae.entity_id
       WHERE ae.enriched_article_id = $1`,
      [a.enriched_article_id]
    );

    if (entityRows.length < 2) {
      aggregate.articlesSkippedNoEntities++;
      continue;
    }

    const nameToIdMap = new Map<string, number>();
    for (const e of entityRows) {
      nameToIdMap.set(e.canonical_name, e.entity_id);
      for (const alias of e.aliases ?? []) {
        if (!nameToIdMap.has(alias)) nameToIdMap.set(alias, e.entity_id);
      }
    }

    try {
      const stats = await extractAndStoreRelationships({
        enrichedArticleId: a.enriched_article_id,
        title: a.title,
        body: a.full_text ?? a.snippet ?? "",
        nameToIdMap,
      });

      aggregate.articlesProcessed++;
      aggregate.triplesEmitted += stats.triplesEmittedByModel;
      aggregate.triplesStored += stats.triplesAcceptedAndStored;
      aggregate.triplesRejectedLowConfidence += stats.triplesRejectedLowConfidence;
      aggregate.triplesRejectedUnresolved += stats.triplesRejectedUnresolvedEntity;
      aggregate.triplesRejectedSelf += stats.triplesRejectedSelfRelation;
      aggregate.triplesUncategorised += stats.triplesUncategorised;

      if ((i + 1) % 5 === 0 || i === articles.length - 1) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(
          `  [${i + 1}/${articles.length}] ${elapsed}s — stored ${aggregate.triplesStored} triples (emitted ${aggregate.triplesEmitted})`
        );
      }
    } catch (err) {
      aggregate.articlesErrored++;
      console.warn(`  Failed on ${a.enriched_article_id}:`, err);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n──────────────────────────────────────────────`);
  console.log(`Backfill complete in ${duration}s`);
  console.log(`──────────────────────────────────────────────`);
  console.log(`Articles processed:           ${aggregate.articlesProcessed}`);
  console.log(`Articles skipped (<2 entities): ${aggregate.articlesSkippedNoEntities}`);
  console.log(`Articles errored:             ${aggregate.articlesErrored}`);
  console.log(`Triples emitted by model:     ${aggregate.triplesEmitted}`);
  console.log(`Triples stored:               ${aggregate.triplesStored}`);
  console.log(`  rejected (low confidence):  ${aggregate.triplesRejectedLowConfidence}`);
  console.log(`  rejected (unresolved entity): ${aggregate.triplesRejectedUnresolved}`);
  console.log(`  rejected (self-relation):   ${aggregate.triplesRejectedSelf}`);
  console.log(`  marked _uncategorised:      ${aggregate.triplesUncategorised}`);
  console.log(`\nNext step: hand-review ~50 randomly sampled triples:`);
  console.log(
    `  SELECT er.id, e1.canonical_name AS subject, er.predicate, e2.canonical_name AS object,`
  );
  console.log(`         er.confidence, er.evidence, ra.title AS source_title`);
  console.log(
    `  FROM entity_relationships er`
  );
  console.log(`  JOIN entities e1 ON e1.id = er.subject_id`);
  console.log(`  JOIN entities e2 ON e2.id = er.object_id`);
  console.log(
    `  LEFT JOIN enriched_articles ea ON ea.id::text = er.source_id`
  );
  console.log(`  LEFT JOIN raw_articles ra ON ra.id = ea.raw_article_id`);
  console.log(`  WHERE er.source_type = 'article'`);
  console.log(`  ORDER BY RANDOM() LIMIT 50;`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
