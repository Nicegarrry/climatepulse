import pool from "@/lib/db";
import { embedQuery } from "@/lib/intelligence/embedder";
import type {
  RetrievalBackend,
  RetrieveInput,
  RetrievedItem,
} from "../types";

/**
 * Pgvector + typed graph walk over entity_relationships.
 *
 * Algorithm:
 *   1. Recursive CTE walks N hops (default 2) from the seed entity IDs over
 *      `entity_relationships`, respecting predicate allowlist + min confidence.
 *   2. Collects the full set of reached entities with their minimum hop distance.
 *   3. Selects content_embeddings rows whose `entity_ids` overlap the walked set.
 *   4. Re-ranks by 0.7 × cosine similarity + 0.3 × (1 / (1 + hops)).
 *   5. Dedupes by (content_type, source_id) keeping the best-scoring chunk.
 *
 * Falls back to pure vector retrieval if no seed entities resolve.
 */

const SIM_WEIGHT = 0.7;
const HOP_WEIGHT = 0.3;

interface WalkRow {
  id: string;
  content_type: string;
  source_id: string;
  chunk_index: number;
  chunk_text: string;
  primary_domain: string | null;
  published_at: string | null;
  significance_composite: number | null;
  similarity: string;
  graph_hops: number | null;
}

export const pgGraphWalkBackend: RetrievalBackend = {
  name: "pg-graph-walk",
  async retrieve(input: RetrieveInput): Promise<RetrievedItem[]> {
    const limit = input.limit;
    const maxHops = input.maxHops ?? 2;
    const minConfidence = input.minConfidence ?? 0.6;
    const predicateAllowlist = input.predicateAllowlist ?? null;

    const queryEmbedding = await embedQuery(input.query);
    const vectorStr = `[${queryEmbedding.join(",")}]`;

    // No seeds → fall back to vector-only behaviour over content_embeddings.
    if (input.seedEntityIds.length === 0) {
      return fallbackVectorOnly(vectorStr, limit);
    }

    const sql = `
      WITH RECURSIVE walk(entity_id, hop) AS (
        SELECT unnest($1::int[]), 0
        UNION
        SELECT
          CASE WHEN er.subject_id = w.entity_id THEN er.object_id
               ELSE er.subject_id END,
          w.hop + 1
        FROM walk w
        JOIN entity_relationships er
          ON er.subject_id = w.entity_id OR er.object_id = w.entity_id
        WHERE w.hop < $2
          AND er.confidence >= $3
          AND er.predicate <> '_uncategorised'
          AND ($4::text[] IS NULL OR er.predicate = ANY($4::text[]))
      ),
      entity_min_hop AS (
        SELECT entity_id, MIN(hop) AS min_hop FROM walk GROUP BY entity_id
      ),
      walked_set AS (
        SELECT array_agg(entity_id) AS entity_ids FROM entity_min_hop
      )
      SELECT
        ce.id,
        ce.content_type,
        ce.source_id,
        ce.chunk_index,
        ce.chunk_text,
        ce.primary_domain,
        ce.published_at,
        ce.significance_composite,
        1 - (ce.embedding <=> $5::vector) AS similarity,
        (
          SELECT MIN(emh.min_hop)
          FROM entity_min_hop emh
          WHERE emh.entity_id = ANY(ce.entity_ids)
        ) AS graph_hops
      FROM content_embeddings ce
      WHERE ce.entity_ids && (SELECT entity_ids FROM walked_set)
      ORDER BY ce.embedding <=> $5::vector
      LIMIT $6
    `;

    const { rows } = await pool.query<WalkRow>(sql, [
      input.seedEntityIds,
      maxHops,
      minConfidence,
      predicateAllowlist,
      vectorStr,
      limit * 3, // over-fetch then dedupe
    ]);

    return rerankAndDedupe(rows, limit);
  },
};

async function fallbackVectorOnly(
  vectorStr: string,
  limit: number
): Promise<RetrievedItem[]> {
  const sql = `
    SELECT
      ce.id,
      ce.content_type,
      ce.source_id,
      ce.chunk_index,
      ce.chunk_text,
      ce.primary_domain,
      ce.published_at,
      ce.significance_composite,
      1 - (ce.embedding <=> $1::vector) AS similarity,
      NULL::int AS graph_hops
    FROM content_embeddings ce
    ORDER BY ce.embedding <=> $1::vector
    LIMIT $2
  `;
  const { rows } = await pool.query<WalkRow>(sql, [vectorStr, limit * 3]);
  return rerankAndDedupe(rows, limit);
}

async function rerankAndDedupe(
  rows: WalkRow[],
  limit: number
): Promise<RetrievedItem[]> {
  const scored = rows.map((r) => {
    const similarity = parseFloat(r.similarity);
    const hops = r.graph_hops;
    const hopBonus = hops != null ? 1 / (1 + hops) : 0;
    const combined =
      similarity * SIM_WEIGHT +
      (hops != null ? hopBonus * HOP_WEIGHT : similarity * HOP_WEIGHT);
    return { row: r, similarity, hops, combined };
  });

  // Dedupe by (content_type, source_id), keeping highest combined score.
  const seen = new Map<string, (typeof scored)[number]>();
  for (const s of scored) {
    const key = `${s.row.content_type}:${s.row.source_id}`;
    const prev = seen.get(key);
    if (!prev || s.combined > prev.combined) seen.set(key, s);
  }

  const top = Array.from(seen.values())
    .sort((a, b) => b.combined - a.combined)
    .slice(0, limit);

  // Resolve display titles per content_type via a single batch.
  const ids = top.map((t) => ({
    content_type: t.row.content_type,
    source_id: t.row.source_id,
  }));
  const displayMap = await resolveDisplayTitles(ids);

  return top.map((t) => {
    const r = t.row;
    const display = displayMap.get(`${r.content_type}:${r.source_id}`) ?? {
      title: `[${r.content_type}] ${r.source_id}`,
      url: null,
    };
    return {
      contentType: r.content_type,
      sourceId: r.source_id,
      title: display.title,
      url: display.url,
      similarity: t.similarity,
      combinedScore: t.combined,
      graphHops: t.hops,
      primaryDomain: r.primary_domain,
      publishedAt: r.published_at,
      significanceComposite: r.significance_composite,
    };
  });
}

async function resolveDisplayTitles(
  refs: { content_type: string; source_id: string }[]
): Promise<Map<string, { title: string; url: string | null }>> {
  const map = new Map<string, { title: string; url: string | null }>();
  if (refs.length === 0) return map;

  const articleIds = refs
    .filter((r) => r.content_type === "article")
    .map((r) => r.source_id);

  if (articleIds.length > 0) {
    const { rows } = await pool.query<{
      id: string;
      title: string;
      article_url: string;
    }>(
      `SELECT ea.id, ra.title, ra.article_url
       FROM enriched_articles ea
       JOIN raw_articles ra ON ra.id = ea.raw_article_id
       WHERE ea.id = ANY($1::uuid[])`,
      [articleIds]
    );
    for (const r of rows) {
      map.set(`article:${r.id}`, { title: r.title, url: r.article_url });
    }
  }

  // Other content types are rare in the spike's seed corpus — fall through
  // with the bracketed default; the comparison is still meaningful by ID.
  return map;
}
