import { retrieveContent } from "@/lib/intelligence/retriever";
import type {
  RetrievalBackend,
  RetrieveInput,
  RetrievedItem,
} from "../types";

/**
 * Pgvector + entity-co-occurrence pre-filter.
 *
 * Identical to the baseline EXCEPT we restrict to content where at least one
 * of the seed entity IDs appears in `content_embeddings.entity_ids`. This is
 * the "do you really need a graph?" backend — captures everything you'd get
 * from a simple entity overlap join, no relationship semantics.
 *
 * If no seed entities are provided (or none resolve), this falls back to
 * pure vector behaviour so thematic queries still produce comparable output.
 */
export const pgvectorCooccurrenceBackend: RetrievalBackend = {
  name: "pgvector-cooccurrence",
  async retrieve(input: RetrieveInput): Promise<RetrievedItem[]> {
    const filters =
      input.seedEntityIds.length > 0
        ? { entity_ids: input.seedEntityIds }
        : {};

    const items = await retrieveContent(input.query, filters, {
      limit: input.limit,
    });

    return items.map((it) => ({
      contentType: it.content_type,
      sourceId: it.source_id,
      title: it.title,
      url: it.url ?? null,
      similarity: it.similarity,
      combinedScore: it.combined_score,
      graphHops: input.seedEntityIds.length > 0 ? 1 : null,
      primaryDomain: it.primary_domain,
      publishedAt: it.published_at,
      significanceComposite: it.significance_composite,
    }));
  },
};
