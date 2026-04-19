import { retrieveContent } from "@/lib/intelligence/retriever";
import type {
  RetrievalBackend,
  RetrieveInput,
  RetrievedItem,
} from "../types";

/**
 * Baseline backend: the existing production retriever with no modifications.
 * Ignores `seedEntityIds`, `maxHops`, `predicateAllowlist` — pure vector +
 * recency/significance/trust ranking via `retrieveContent`.
 */
export const pgvectorOnlyBackend: RetrievalBackend = {
  name: "pgvector-only",
  async retrieve(input: RetrieveInput): Promise<RetrievedItem[]> {
    const items = await retrieveContent(
      input.query,
      {},
      { limit: input.limit }
    );

    return items.map((it) => ({
      contentType: it.content_type,
      sourceId: it.source_id,
      title: it.title,
      url: it.url ?? null,
      similarity: it.similarity,
      combinedScore: it.combined_score,
      graphHops: null,
      primaryDomain: it.primary_domain,
      publishedAt: it.published_at,
      significanceComposite: it.significance_composite,
    }));
  },
};
