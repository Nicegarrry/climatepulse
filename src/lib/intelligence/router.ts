/**
 * Conditional retrieval router for the Learn feature.
 *
 * Decides per-query whether to use the typed graph-walk backend or the
 * vector-only baseline. The routing heuristic is intentionally simple
 * (and fast — ~10 ms) so we can iterate based on real usage logs.
 *
 * Heuristic — route to graph-walk when BOTH:
 *   1. At least 1 named entity in the query resolves in `entities`
 *      (canonical name OR alias)
 *   2. The query exhibits a multi-hop verb / preposition pattern
 *      (e.g. "funded by", "operated by", "subsidiaries of",
 *      "acquired by", "linking X and Y")
 *
 * Otherwise → vector backend (`retrieveContent`).
 *
 * Background: the spike showed graph-walk wins big on multi-hop intent.
 * The killer case (mh-01: "projects funded by ARENA") was 1 seed entity +
 * a traversal verb and went from 0.00 → 2.00 mean@3. So the threshold has
 * to admit single-seed multi-hop queries — requiring ≥2 entities would
 * miss exactly the queries graph-walk is best at. The trade-off: some
 * entity-anchored queries with a multi-hop word in them (e.g. "What is
 * AGL acquired by?") may now route to graph-walk and underperform.
 * Mitigated by logging every routing decision; tighten the heuristic
 * once we have real Learn usage data. See
 * docs/graph-rag-spike/04-recommendation.md.
 */

import pool from "@/lib/db";
import { retrieveContent } from "@/lib/intelligence/retriever";
import { pgGraphWalkBackend } from "@/lib/intelligence/evaluation/backends/pg-graph-walk";
import type { RetrievedContent } from "@/lib/intelligence/retriever";

// ─── Multi-hop pattern detection ──────────────────────────────────────────────

/**
 * Phrases that strongly suggest the query wants to traverse a relationship,
 * not just match semantically. Keep this list curated and small — false
 * positives push entity-anchored queries onto the wrong backend.
 *
 * Tested against the harness query set during the spike — these are the
 * patterns that actually appeared in mh-01 / mh-04 and similar.
 */
const MULTI_HOP_PATTERNS: RegExp[] = [
  /\bfunded by\b/i,
  /\bowned by\b/i,
  /\boperated by\b/i,
  /\bdeveloped by\b/i,
  /\bacquired by\b/i,
  /\bsubsidiar(?:y|ies) of\b/i,
  /\bcompetitors? of\b/i,
  /\bpartners? of\b/i,
  /\binvest(?:s|ed|ing) in\b/i,
  /\bregulated by\b/i,
  /\bsupersed(?:e|es|ed) by\b/i,
  /\bopposed by\b/i,
  /\bfounder(?:s)? of\b/i,
  /\bceo of\b/i,
  /\b(?:link|linking|connect|connection)s? between\b/i,
  /\b(?:which|what) (?:projects?|companies?|people|regulations?) (?:are|were) (?:funded|owned|operated|developed|acquired|founded)\b/i,
  /\bhow does .+ (?:connect|relate|link) to\b/i,
];

export function detectMultiHopIntent(query: string): {
  matched: boolean;
  patterns: string[];
} {
  const matched: string[] = [];
  for (const pat of MULTI_HOP_PATTERNS) {
    if (pat.test(query)) matched.push(pat.source);
  }
  return { matched: matched.length > 0, patterns: matched };
}

// ─── Entity extraction from query ─────────────────────────────────────────────

/**
 * Extract candidate phrases from the query that might be named entities.
 * Heuristic: title-cased word runs of length ≥ 2 chars. Also keeps short
 * runs of all-caps words (acronyms like AGL, AEMO, ARENA, RET).
 *
 * Only used as the candidate set we hand to the DB — actual entity
 * resolution happens via `entities` table lookup, which is the source
 * of truth.
 */
export function extractCandidateEntityPhrases(query: string): string[] {
  const candidates = new Set<string>();

  // Multi-word title-case phrases: "Origin Energy", "Andrew Forrest", "Loy Yang"
  const titleCaseMulti = query.matchAll(
    /\b([A-Z][a-z]+(?:\s+[A-Z][A-Za-z0-9]*){1,4})\b/g
  );
  for (const m of titleCaseMulti) candidates.add(m[1].trim());

  // Single all-caps tokens of length ≥ 2 (AGL, AEMO, ARENA, RET, BHP)
  const acronyms = query.matchAll(/\b([A-Z]{2,8})\b/g);
  for (const m of acronyms) candidates.add(m[1].trim());

  // Single Capitalized word followed by a number-like suffix (Snowy 2.0, AGL)
  const wordPlusNumber = query.matchAll(
    /\b([A-Z][a-z]+(?:\s+\d+(?:\.\d+)?)?)\b/g
  );
  for (const m of wordPlusNumber) {
    const phrase = m[1].trim();
    if (phrase.length >= 3) candidates.add(phrase);
  }

  return Array.from(candidates);
}

/**
 * Resolve candidate phrases against the `entities` table.
 * Returns the IDs of entities that match either canonical_name or aliases.
 */
export async function resolveQueryEntities(
  candidates: string[]
): Promise<{ entityIds: number[]; matchedNames: string[] }> {
  if (candidates.length === 0) return { entityIds: [], matchedNames: [] };

  const { rows } = await pool.query<{
    id: number;
    canonical_name: string;
    aliases: string[];
  }>(
    `SELECT id, canonical_name, aliases FROM entities
     WHERE canonical_name = ANY($1::text[])
        OR aliases && $1::text[]`,
    [candidates]
  );

  const entityIds = new Set<number>();
  const matchedNames = new Set<string>();
  for (const r of rows) {
    entityIds.add(r.id);
    if (candidates.includes(r.canonical_name)) {
      matchedNames.add(r.canonical_name);
    }
    for (const alias of r.aliases ?? []) {
      if (candidates.includes(alias)) matchedNames.add(alias);
    }
  }

  return {
    entityIds: Array.from(entityIds),
    matchedNames: Array.from(matchedNames),
  };
}

// ─── Classification ──────────────────────────────────────────────────────────

export type RoutingDecision = "graph-walk" | "vector";

export interface QueryClassification {
  decision: RoutingDecision;
  reason: string;
  multiHopMatched: boolean;
  multiHopPatterns: string[];
  candidateEntityPhrases: string[];
  resolvedEntityIds: number[];
  resolvedEntityNames: string[];
}

export async function classifyQuery(
  query: string
): Promise<QueryClassification> {
  const multiHop = detectMultiHopIntent(query);
  const candidates = extractCandidateEntityPhrases(query);
  const { entityIds, matchedNames } = await resolveQueryEntities(candidates);

  let decision: RoutingDecision = "vector";
  let reason: string;

  if (multiHop.matched && entityIds.length >= 1) {
    decision = "graph-walk";
    reason = `${entityIds.length} resolved entit${entityIds.length === 1 ? "y" : "ies"} + multi-hop pattern(s): ${multiHop.patterns.slice(0, 2).join(", ")}`;
  } else if (multiHop.matched && entityIds.length === 0) {
    reason = `multi-hop pattern matched but no entities resolved — vector fallback`;
  } else if (entityIds.length >= 2) {
    reason = `${entityIds.length} resolved entities but no multi-hop pattern — vector handles this better per spike data`;
  } else {
    reason = `thematic / single-entity query (${entityIds.length} entities resolved)`;
  }

  return {
    decision,
    reason,
    multiHopMatched: multiHop.matched,
    multiHopPatterns: multiHop.patterns,
    candidateEntityPhrases: candidates,
    resolvedEntityIds: entityIds,
    resolvedEntityNames: matchedNames,
  };
}

// ─── Unified retrieval entry point ──────────────────────────────────────────

export interface RouterOptions {
  limit?: number;
  /** Override the routing decision. Useful for A/B testing or debugging. */
  forceBackend?: RoutingDecision;
  /** Graph-walk hop depth. Default 2. */
  maxHops?: 1 | 2 | 3;
  /** Graph-walk min triple confidence. Default 0.6. */
  minConfidence?: number;
}

export interface RouterResult {
  items: RetrievedContent[];
  backendUsed: RoutingDecision;
  classification: QueryClassification;
  latencyMs: number;
}

/**
 * Classify the query, pick the backend, retrieve, and return everything
 * the caller needs to display + log.
 *
 * The graph-walk path goes through `pgGraphWalkBackend` (returns minimal
 * `RetrievedItem` shape) and then re-resolves display data via
 * `retrieveContent` filtered to the same source IDs — this keeps the
 * caller's contract identical regardless of which backend ran.
 */
export async function routeAndRetrieve(
  query: string,
  options: RouterOptions = {}
): Promise<RouterResult> {
  const start = Date.now();
  const limit = options.limit ?? 10;

  const classification = await classifyQuery(query);
  const backendUsed = options.forceBackend ?? classification.decision;

  let items: RetrievedContent[];

  if (backendUsed === "graph-walk" && classification.resolvedEntityIds.length >= 1) {
    // Graph-walk path. Returns minimal shape; we re-fetch full RetrievedContent
    // shape via retrieveContent filtered to the same source IDs so the API
    // contract is consistent.
    const graphResults = await pgGraphWalkBackend.retrieve({
      query,
      seedEntityIds: classification.resolvedEntityIds,
      limit,
      maxHops: options.maxHops ?? 2,
      minConfidence: options.minConfidence ?? 0.6,
    });
    items = await rehydrateAsRetrievedContent(graphResults, query, limit);
  } else {
    // Vector baseline.
    items = await retrieveContent(query, {}, { limit });
  }

  return {
    items,
    backendUsed,
    classification,
    latencyMs: Date.now() - start,
  };
}

// ─── Internal: rehydrate graph-walk results into the full RetrievedContent shape ─

/**
 * pgGraphWalkBackend returns a minimal `RetrievedItem` (designed for the
 * comparison harness). The Learn API surface expects `RetrievedContent`
 * with full display data, signal_type, sentiment, etc. We rehydrate by
 * filtering retrieveContent to the source IDs the graph-walk found,
 * preserving the graph-walk ordering.
 */
async function rehydrateAsRetrievedContent(
  graphItems: { contentType: string; sourceId: string; combinedScore: number }[],
  _query: string,
  _limit: number
): Promise<RetrievedContent[]> {
  if (graphItems.length === 0) return [];

  const articleIds = graphItems
    .filter((g) => g.contentType === "article")
    .map((g) => g.sourceId);

  if (articleIds.length === 0) return [];

  // Pull the chunked rows for these source IDs (chunk_index = 0 for stable display).
  const { rows } = await pool.query(
    `SELECT
       ce.content_type,
       ce.source_id,
       ce.chunk_index,
       ce.chunk_text,
       1.0 AS similarity,
       1.0 AS combined_score,
       ce.primary_domain,
       ce.microsector_ids,
       ce.signal_type,
       ce.sentiment,
       ce.jurisdictions,
       ce.entity_ids,
       ce.published_at,
       ce.significance_composite,
       ce.trustworthiness_tier
     FROM content_embeddings ce
     WHERE ce.content_type = 'article' AND ce.source_id = ANY($1::uuid[]) AND ce.chunk_index = 0`,
    [articleIds]
  );

  // Re-resolve display data via the existing retriever helper. We call
  // retrieveContent here just to get the resolveDisplayData treatment by
  // proxy — but since that's internal, we duplicate the article join here
  // for the spike-shipped path. Future cleanup: extract resolveDisplayData
  // as exported helper if this rehydration approach stays.
  const { rows: displayRows } = await pool.query<{
    id: string;
    title: string;
    snippet: string | null;
    source_name: string;
    article_url: string;
  }>(
    `SELECT ea.id, ra.title, ra.snippet, ra.source_name, ra.article_url
     FROM enriched_articles ea
     JOIN raw_articles ra ON ra.id = ea.raw_article_id
     WHERE ea.id = ANY($1::uuid[])`,
    [articleIds]
  );

  const displayMap = new Map<string, { title: string; subtitle: string; url: string; snippet: string | null }>();
  for (const d of displayRows) {
    displayMap.set(d.id, {
      title: d.title,
      subtitle: d.source_name,
      url: d.article_url,
      snippet: d.snippet,
    });
  }

  // Preserve the graph-walk ordering by source_id.
  const orderedSourceIds = articleIds;
  const merged: RetrievedContent[] = [];
  for (const sid of orderedSourceIds) {
    const row = rows.find((r) => r.source_id === sid);
    if (!row) continue;
    const display = displayMap.get(sid);
    const graphItem = graphItems.find((g) => g.sourceId === sid);
    merged.push({
      content_type: row.content_type,
      source_id: row.source_id,
      chunk_index: row.chunk_index,
      chunk_text: row.chunk_text,
      similarity: 1.0,
      combined_score: graphItem?.combinedScore ?? 1.0,
      primary_domain: row.primary_domain,
      microsector_ids: row.microsector_ids ?? [],
      signal_type: row.signal_type,
      sentiment: row.sentiment,
      jurisdictions: row.jurisdictions ?? [],
      entity_ids: row.entity_ids ?? [],
      published_at: row.published_at,
      significance_composite: row.significance_composite,
      trustworthiness_tier: row.trustworthiness_tier,
      title: display?.title ?? `[article] ${sid}`,
      subtitle: display?.subtitle ?? null,
      url: display?.url ?? null,
      snippet: display?.snippet ?? null,
    });
  }

  return merged;
}
