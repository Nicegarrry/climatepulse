import { retrieveForLearn } from "@/lib/learn/retriever-extensions";
import type { RetrievedContent } from "@/lib/intelligence/retriever";
import type { Intent } from "./types";

export interface SelectorOptions {
  maxCandidates?: number;
  minSignificance?: number;
  recencyDays?: number;
}

function score(c: RetrievedContent, now: Date, halfLifeDays = 45): number {
  const sig = (c.significance_composite ?? 50) / 100;
  let recency = 1;
  if (c.published_at) {
    const days = (now.getTime() - new Date(c.published_at).getTime()) / (1000 * 60 * 60 * 24);
    recency = Math.pow(0.5, days / halfLifeDays);
  }
  const editorialBoost =
    c.content_type === "concept_card" || c.content_type === "microsector_brief"
      ? 1.2
      : 1.0;
  return sig * recency * editorialBoost;
}

function dedupeBySource(items: RetrievedContent[]): RetrievedContent[] {
  const seen = new Map<string, RetrievedContent>();
  for (const item of items) {
    const key = `${item.content_type}:${item.source_id}`;
    const prev = seen.get(key);
    if (!prev || item.combined_score > prev.combined_score) seen.set(key, item);
  }
  return [...seen.values()];
}

/**
 * Select substrate candidates for a path intent.
 * Parallel queries for each Learn content type + briefings + podcasts.
 * Merge, dedupe, and rank by significance × recency × editorial boost.
 */
export async function selectCandidates(
  intent: Intent,
  opts: SelectorOptions = {},
): Promise<RetrievedContent[]> {
  const maxCandidates = opts.maxCandidates ?? 60;
  const minSignificance = opts.minSignificance ?? 40;
  const recencyDays = opts.recencyDays ?? 90;
  const now = new Date();
  const dateFrom = new Date(now.getTime() - recencyDays * 86400000).toISOString();
  const microsector_ids = intent.in_scope_microsectors;

  const query =
    intent.orientation.trim() || "climate energy sustainability fundamentals";

  const [cards, briefs, blocks, articles, podcasts, deepDives] = await Promise.all([
    retrieveForLearn(
      query,
      { microsector_ids, content_types: ["concept_card" as never] },
      { limit: 20, dedupeBySource: true },
    ),
    retrieveForLearn(
      query,
      { microsector_ids, content_types: ["microsector_brief" as never] },
      { limit: 10, dedupeBySource: true },
    ),
    retrieveForLearn(
      query,
      { microsector_ids, content_types: ["microsector_brief_block" as never] },
      { limit: 15, dedupeBySource: true },
    ),
    retrieveForLearn(
      query,
      {
        microsector_ids,
        content_types: ["article" as never],
        min_significance: minSignificance,
        date_from: dateFrom,
      },
      {
        limit: 20,
        significanceBoost: 0.3,
        recencyBoost: 0.2,
        dedupeBySource: true,
      },
    ),
    retrieveForLearn(
      query,
      {
        microsector_ids,
        content_types: ["podcast" as never],
        date_from: dateFrom,
      },
      { limit: 10, recencyBoost: 0.2, dedupeBySource: true },
    ),
    retrieveForLearn(
      query,
      { microsector_ids, content_types: ["deep_dive" as never] },
      { limit: 5, dedupeBySource: true },
    ),
  ]);

  const all = [...cards, ...briefs, ...blocks, ...articles, ...podcasts, ...deepDives];
  const deduped = dedupeBySource(all);

  return deduped
    .map((c) => ({ c, s: score(c, now) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, maxCandidates)
    .map((x) => x.c);
}
