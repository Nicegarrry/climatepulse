/**
 * Backend-agnostic retrieval interface for the graph-RAG evaluation harness.
 *
 * Any future implementation (LightRAG, Neo4j, a hosted vector DB) implements
 * this same shape and drops into the harness. This is the spike's primary
 * piece of migration insurance: comparison results, regression tests, and
 * downstream callers all talk to one contract.
 */

export type EvalCategory =
  | "entity_walk"
  | "thematic"
  | "multi_hop"
  | "contradiction"
  | "calibration";

export interface QueryDef {
  /** Stable ID — used in CSV output and regression diffs. */
  id: string;
  category: EvalCategory;
  /** The natural-language query passed to each backend. */
  query: string;
  /**
   * Human-readable seed entity names. The harness resolves these to
   * `entities.id` at run time. Required for entity_walk + multi_hop, ignored
   * by pure pgvector backends.
   */
  seedEntities?: string[];
  /** Free-text reviewer note about what a "good" answer looks like. */
  notes?: string;
}

export interface RetrieveInput {
  query: string;
  /** Resolved entity IDs (post-name-lookup). Empty array if none. */
  seedEntityIds: number[];
  limit: number;
  /** Graph-walk specific. Backends without graph semantics MUST ignore. */
  maxHops?: 1 | 2 | 3;
  predicateAllowlist?: string[];
  minConfidence?: number;
}

export interface RetrievedItem {
  contentType: string;
  sourceId: string;
  title: string;
  url?: string | null;
  /** Cosine similarity to the query embedding. Null when the backend doesn't compute one. */
  similarity: number | null;
  /** Backend's final ranking score (higher = better). */
  combinedScore: number;
  /** Minimum hop distance from any seed entity. Null for non-graph backends. */
  graphHops?: number | null;
  primaryDomain?: string | null;
  publishedAt?: string | null;
  significanceComposite?: number | null;
}

export interface RetrievalBackend {
  readonly name: string;
  retrieve(input: RetrieveInput): Promise<RetrievedItem[]>;
}

export interface QueryResult {
  queryId: string;
  query: string;
  category: EvalCategory;
  backend: string;
  items: RetrievedItem[];
  latencyMs: number;
  error?: string;
}
