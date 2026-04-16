// Newsroom ingest orchestrator.
//
// Run from /api/newsroom/ingest by Vercel Cron every 30 min during Sydney
// business hours, and runnable manually for local testing.
//
// Flow:
//   1. Guard: refuse to run outside business hours (cheap early exit).
//   2. Poll RSS, NewsAPI.org, NewsAPI.ai, Google News in parallel. All four
//      write into raw_articles via the existing ON CONFLICT (article_url)
//      DO NOTHING dedup so cross-fetcher duplicates are handled at the DB.
//   3. dedupPendingBatch — assign title_hash + soft pg_trgm dedup.
//   4. Select unclassified raw_articles published in the last 72h.
//   5. Classify in batches of 15 with concurrency 3 (Gemini Flash-lite).
//   6. Insert results into newsroom_items.
//   7. Fan out push notifications for any urgency-5 items just inserted.
//   8. Log to newsroom_runs.

import pool from "@/lib/db";
import { GEMINI_MODEL } from "@/lib/ai-models";
import { isBusinessHours, describeSydneyClock } from "./business-hours";
import { dedupPendingBatch } from "./dedup";
import { classifyArticles } from "./classifier";
import { fetchGoogleNews } from "./google-news-fetch";
import { pollAllFeeds } from "@/lib/discovery/poller";
import { fetchNewsApiOrg } from "@/lib/discovery/newsapi-org";
import { fetchNewsApiAi } from "@/lib/discovery/newsapi-ai";
import { fanoutUrgency5 } from "./fanout";
import type { ClassifierInput, IngestRunSummary } from "./types";

const SELECT_UNCLASSIFIED_LIMIT = 100;
const PUBLISHED_LOOKBACK_HOURS = 72;

interface RunOptions {
  trigger: "cron" | "manual";
  ignoreBusinessHours?: boolean;
}

export async function runNewsroomIngest(
  opts: RunOptions
): Promise<IngestRunSummary> {
  const start = Date.now();
  const summary: IngestRunSummary = {
    trigger: opts.trigger,
    ingested: 0,
    deduped: 0,
    classified: 0,
    urgency5_pushes: 0,
    cost_cents: 0,
    duration_ms: 0,
    fetcher_breakdown: {},
  };

  if (!opts.ignoreBusinessHours && !isBusinessHours()) {
    summary.skipped_reason = "outside-hours";
    summary.duration_ms = Date.now() - start;
    await logRun(summary);
    return summary;
  }

  // ── Step 2: poll all four sources in parallel ─────────────────────────────
  const fetchers = await Promise.allSettled([
    pollAllFeeds(),
    fetchNewsApiOrg(),
    fetchNewsApiAi(),
    fetchGoogleNews(),
  ]);

  const fetcherLabels = ["RSS", "NewsAPI.org", "NewsAPI.ai", "Google News"];
  for (let i = 0; i < fetchers.length; i++) {
    const r = fetchers[i];
    if (r.status === "fulfilled") {
      const value = r.value as { new_articles: number };
      summary.fetcher_breakdown![fetcherLabels[i]] = value.new_articles ?? 0;
      summary.ingested += value.new_articles ?? 0;
    } else {
      summary.fetcher_breakdown![fetcherLabels[i]] = -1;
      console.warn(`Fetcher ${fetcherLabels[i]} failed:`, r.reason);
    }
  }

  // ── Step 3: dedup pass ────────────────────────────────────────────────────
  try {
    const dedup = await dedupPendingBatch();
    summary.deduped = dedup.hash_collisions + dedup.soft_duplicates;
  } catch (err) {
    console.error("Dedup pass failed:", err);
  }

  // ── Step 4: select unclassified articles in the last 72h ──────────────────
  const candidates = await pool.query<{
    id: string;
    title: string;
    snippet: string | null;
    source_name: string;
    published_at: string | null;
  }>(
    `SELECT ra.id, ra.title, ra.snippet, ra.source_name, ra.published_at
       FROM raw_articles ra
       LEFT JOIN newsroom_items ni ON ni.raw_article_id = ra.id
      WHERE ni.id IS NULL
        AND ra.published_at IS NOT NULL
        AND ra.published_at > NOW() - ($1 || ' hours')::interval
      ORDER BY ra.fetched_at DESC
      LIMIT $2`,
    [String(PUBLISHED_LOOKBACK_HOURS), SELECT_UNCLASSIFIED_LIMIT]
  );

  if (candidates.rows.length === 0) {
    summary.duration_ms = Date.now() - start;
    await logRun(summary);
    return summary;
  }

  const inputs: ClassifierInput[] = candidates.rows.map((r) => ({
    id: r.id,
    title: r.title.slice(0, 200),
    snippet: (r.snippet ?? "").slice(0, 400),
    source: r.source_name,
    published_at: r.published_at,
  }));

  // ── Step 5: classify in batches ──────────────────────────────────────────
  const { results, costCents } = await classifyArticles(inputs);
  summary.cost_cents = costCents;

  // ── Step 6: persist newsroom_items ───────────────────────────────────────
  // Need source_name + published_at — keep them in a quick lookup map.
  const articleLookup = new Map(
    candidates.rows.map((r) => [r.id, r])
  );
  const inserted: Array<{ item_id: string; raw_article_id: string }> = [];

  for (const r of results) {
    const a = articleLookup.get(r.id);
    if (!a || !a.published_at) continue;
    try {
      const ins = await pool.query<{ id: string }>(
        `INSERT INTO newsroom_items
           (raw_article_id, primary_domain, urgency, teaser,
            classifier_model, classifier_version, published_at, source_name)
         VALUES ($1, $2, $3, $4, $5, 'v1', $6, $7)
         ON CONFLICT (raw_article_id) DO NOTHING
         RETURNING id`,
        [
          r.id,
          r.primary_domain,
          r.urgency,
          r.teaser,
          GEMINI_MODEL,
          a.published_at,
          a.source_name,
        ]
      );
      if (ins.rows.length > 0) {
        summary.classified++;
        if (r.urgency === 5) {
          inserted.push({ item_id: ins.rows[0].id, raw_article_id: r.id });
        }
      }
    } catch (err) {
      console.warn(
        `Failed to insert newsroom_item for raw_article_id=${r.id}:`,
        err
      );
    }
  }

  // ── Step 7: fan out push notifications for newly inserted urgency-5 ──────
  if (inserted.length > 0) {
    try {
      summary.urgency5_pushes = await fanoutUrgency5(
        inserted.map((i) => i.item_id)
      );
    } catch (err) {
      console.error("Push fanout failed:", err);
    }
  }

  summary.duration_ms = Date.now() - start;
  await logRun(summary);

  console.log(
    `[newsroom] ${describeSydneyClock()} | ingested=${summary.ingested} ` +
      `dedup=${summary.deduped} classified=${summary.classified} ` +
      `pushes=${summary.urgency5_pushes} cost_c=${summary.cost_cents.toFixed(2)} ` +
      `dur=${summary.duration_ms}ms`
  );

  return summary;
}

async function logRun(summary: IngestRunSummary): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO newsroom_runs
        (trigger, duration_ms, ingested, deduped, classified, urgency5_pushes,
         cost_cents, skipped_reason, error)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        summary.trigger,
        summary.duration_ms,
        summary.ingested,
        summary.deduped,
        summary.classified,
        summary.urgency5_pushes,
        summary.cost_cents,
        summary.skipped_reason ?? null,
        summary.error ?? null,
      ]
    );
  } catch (err) {
    console.error("Failed to log newsroom run:", err);
  }
}
