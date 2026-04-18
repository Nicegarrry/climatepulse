import { retrieveContent, type RetrievedContent } from "@/lib/intelligence/retriever";

// Per-tier token budgets (approx: 1 token ≈ 4 chars of English text).
const DAILY_BUDGET_CHARS = 2_000 * 4;
const THEMED_BUDGET_CHARS = 4_000 * 4;
const FLAGSHIP_BUDGET_CHARS = 6_000 * 4;

export interface PodcastRagContext {
  /** Pre-formatted markdown block ready to inject into the script prompt. Empty string if no usable hits. */
  block: string;
  /** Raw hits for optional downstream use (e.g. source attribution). */
  hits: RetrievedContent[];
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function formatHit(h: RetrievedContent): string {
  const date = h.published_at ? h.published_at.slice(0, 10) : "undated";
  const kind =
    h.content_type === "daily_digest"
      ? "our daily briefing"
      : h.content_type === "weekly_digest"
        ? "Weekly Pulse"
        : h.content_type === "podcast"
          ? "our podcast"
          : h.content_type === "weekly_report"
            ? "our weekly report"
            : h.subtitle ?? "article";
  const title = h.title.length > 140 ? h.title.slice(0, 137) + "…" : h.title;
  return `- [${date} · ${kind}] ${title}`;
}

function truncateToBudget(lines: string[], budgetChars: number): string[] {
  const out: string[] = [];
  let used = 0;
  for (const line of lines) {
    if (used + line.length + 1 > budgetChars) break;
    out.push(line);
    used += line.length + 1;
  }
  return out;
}

/**
 * Daily: short entity-continuity context. Thin because the existing
 * fetchEntityHistory() in script-generator.ts already does the heavy entity
 * callbacks — this is the fallback for generic topical continuity when entity
 * resolution didn't yield enough material.
 */
export async function fetchDailyRagContext(query: string): Promise<PodcastRagContext> {
  const hits = await retrieveContent(
    query,
    {
      content_types: ["daily_digest", "podcast"],
      date_from: daysAgo(14),
      trustworthiness_tiers: [0],
    },
    { limit: 5, dedupeBySource: true, significanceBoost: 0.1, recencyBoost: 0.3 }
  ).catch(() => []);

  if (hits.length === 0) return { block: "", hits: [] };

  const lines = truncateToBudget(hits.map(formatHit), DAILY_BUDGET_CHARS);
  const block = `RECENT CLIMATEPULSE COVERAGE (for continuity — reference only when it genuinely reframes today's story):\n${lines.join("\n")}`;
  return { block, hits };
}

/**
 * Themed 15-min deep-dive: broader lookback, domain-filtered, includes primary
 * sources so the script can cite articles as well as our editorial.
 */
export async function fetchThemedRagContext(
  query: string,
  opts: { domains?: string[]; entity_ids?: number[] } = {}
): Promise<PodcastRagContext> {
  const hits = await retrieveContent(
    query,
    {
      content_types: ["article", "daily_digest", "podcast", "weekly_digest"],
      domains: opts.domains,
      entity_ids: opts.entity_ids,
      date_from: daysAgo(30),
      min_significance: 50,
    },
    { limit: 15, dedupeBySource: true, significanceBoost: 0.25, recencyBoost: 0.2, trustBoost: 0.15 }
  ).catch(() => []);

  if (hits.length === 0) return { block: "", hits: [] };

  const lines = truncateToBudget(hits.map(formatHit), THEMED_BUDGET_CHARS);
  const block = `30-DAY CONTEXT (use for trend arcs, prior coverage, and "as we discussed" callbacks):\n${lines.join("\n")}`;
  return { block, hits };
}

/**
 * Flagship 45-min: 8-week corpus across articles + editorial + prior flagship
 * episodes. Largest budget — long-form exposition benefits from deeper recall.
 */
export async function fetchFlagshipRagContext(
  query: string,
  opts: { domains?: string[]; entity_ids?: number[] } = {}
): Promise<PodcastRagContext> {
  const hits = await retrieveContent(
    query,
    {
      content_types: ["article", "daily_digest", "podcast", "weekly_digest", "weekly_report"],
      domains: opts.domains,
      entity_ids: opts.entity_ids,
      date_from: daysAgo(56),
      min_significance: 60,
    },
    { limit: 30, dedupeBySource: true, significanceBoost: 0.3, recencyBoost: 0.15, trustBoost: 0.2 }
  ).catch(() => []);

  if (hits.length === 0) return { block: "", hits: [] };

  const lines = truncateToBudget(hits.map(formatHit), FLAGSHIP_BUDGET_CHARS);
  const block = `8-WEEK CORPUS (for recall, continuity, "last month we covered", and arc-building):\n${lines.join("\n")}`;
  return { block, hits };
}
