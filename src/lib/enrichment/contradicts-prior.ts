// src/lib/enrichment/contradicts-prior.ts
//
// Detect when a newly-enriched article contradicts prior coverage of the
// same entities, and set enriched_articles.contradicts_prior = TRUE.
//
// Heuristic: among all prior article-type embeddings within the last 30 days
// that share at least one entity with the new article AND carry the opposite
// sentiment, if any has cosine similarity >= SIMILARITY_THRESHOLD to the new
// article's main chunk, the new article is contradicting prior coverage.
//
// Call this AFTER embedAndStoreArticle so the new article's own chunks exist
// in content_embeddings — we use the new article's own embedding as the query
// vector (free — no additional embed API call).

import pool from "@/lib/db";

// Tuned high enough to avoid spurious "same topic, same view" matches.
// 0.70 in our verify script returned semantically-coherent but not
// contradicting neighbours, so 0.72 is a modest lift that should catch
// genuinely contradictory re-coverage.
const SIMILARITY_THRESHOLD = 0.72;
const LOOKBACK_DAYS = 30;

const OPPOSITE_SENTIMENT: Record<string, string | null> = {
  positive: "negative",
  negative: "positive",
  neutral: null, // no clear opposite
  mixed: null,
};

export async function checkContradictsPrior(
  enrichedArticleId: string
): Promise<{ flagged: boolean; matches: string[] }> {
  // 1. Look up the new article's sentiment + entities. Bail on neutral/mixed
  //    (no meaningful "opposite") or entity-less articles (no filter basis).
  const { rows: meta } = await pool.query<{
    sentiment: string | null;
    entity_ids: number[];
    published_at: string | null;
  }>(
    `SELECT ea.sentiment::text AS sentiment,
            ARRAY(SELECT ae.entity_id FROM article_entities ae WHERE ae.enriched_article_id = ea.id) AS entity_ids,
            ra.published_at
       FROM enriched_articles ea
       JOIN raw_articles ra ON ra.id = ea.raw_article_id
      WHERE ea.id = $1`,
    [enrichedArticleId]
  );
  if (meta.length === 0) return { flagged: false, matches: [] };
  const { sentiment, entity_ids, published_at } = meta[0];

  const opposite = sentiment ? OPPOSITE_SENTIMENT[sentiment] : null;
  if (!opposite || entity_ids.length === 0) {
    return { flagged: false, matches: [] };
  }

  // 2. Query for prior articles with entity overlap + opposite sentiment
  //    + high similarity to this article's first chunk. Use <=> (cosine
  //    distance) — similarity = 1 - distance.
  const { rows: hits } = await pool.query<{
    source_id: string;
    similarity: number;
  }>(
    `WITH anchor AS (
       SELECT embedding
         FROM content_embeddings
        WHERE content_type = 'article'
          AND source_id = $1
          AND chunk_index = 0
        LIMIT 1
     )
     SELECT ce.source_id,
            1 - (ce.embedding <=> (SELECT embedding FROM anchor)) AS similarity
       FROM content_embeddings ce
      WHERE ce.content_type = 'article'
        AND ce.source_id <> $1
        AND ce.entity_ids && $2::int[]
        AND ce.sentiment = $3
        AND ce.published_at IS NOT NULL
        AND ce.published_at >= NOW() - ($4 || ' days')::interval
        AND ($5::timestamptz IS NULL OR ce.published_at < $5::timestamptz)
        AND 1 - (ce.embedding <=> (SELECT embedding FROM anchor)) >= $6
      ORDER BY ce.embedding <=> (SELECT embedding FROM anchor)
      LIMIT 5`,
    [
      enrichedArticleId,
      entity_ids,
      opposite,
      String(LOOKBACK_DAYS),
      published_at,
      SIMILARITY_THRESHOLD,
    ]
  );

  if (hits.length === 0) return { flagged: false, matches: [] };

  const sourceIds = hits.map((h) => h.source_id);

  await pool.query(
    `UPDATE enriched_articles
        SET contradicts_prior = TRUE,
            contradicted_source_ids = $2
      WHERE id = $1`,
    [enrichedArticleId, sourceIds]
  );

  return { flagged: true, matches: sourceIds };
}
