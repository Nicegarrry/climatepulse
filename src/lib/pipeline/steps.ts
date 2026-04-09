// src/lib/pipeline/steps.ts

import type { StepResult } from "./types";

// ─── Helpers ────────────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString();
}

function elapsed(start: number): number {
  return Date.now() - start;
}

async function runStep(
  name: StepResult["name"],
  fn: () => Promise<Record<string, unknown>>
): Promise<StepResult> {
  const started_at = now();
  const t0 = Date.now();
  try {
    const result = await fn();
    return {
      name,
      status: "completed",
      started_at,
      completed_at: now(),
      duration_ms: elapsed(t0),
      result,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      name,
      status: "failed",
      started_at,
      completed_at: now(),
      duration_ms: elapsed(t0),
      result: {},
      error: message,
    };
  }
}

// ─── Step 1: Ingest ─────────────────────────────────────────────────────────

export async function step1Ingest(): Promise<StepResult> {
  return runStep("ingest", async () => {
    const { pollAllFeeds } = await import("@/lib/discovery/poller");
    const { scrapeAllTargets } = await import("@/lib/discovery/scraper");
    const { fetchNewsApiAi } = await import("@/lib/discovery/newsapi-ai");
    const { fetchNewsApiOrg } = await import("@/lib/discovery/newsapi-org");

    const results = await Promise.allSettled([
      pollAllFeeds(),
      scrapeAllTargets(),
      fetchNewsApiAi(),
      fetchNewsApiOrg(),
    ]);

    let new_articles = 0;
    let duplicates_skipped = 0;
    let source_errors = 0;
    let sources_succeeded = 0;
    const error_details: Array<{ source: string; error: string }> = [];

    const labels = ["rss", "scrape", "newsapi_ai", "newsapi_org"];
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === "fulfilled") {
        sources_succeeded++;
        new_articles += r.value.new_articles;
        duplicates_skipped += r.value.duplicates_skipped;
        source_errors += r.value.errors;
        if (r.value.error_details) {
          for (const d of r.value.error_details) {
            error_details.push({ source: labels[i], error: d.error ?? d.source ?? String(d) });
          }
        }
      } else {
        error_details.push({ source: labels[i], error: r.reason?.message ?? String(r.reason) });
      }
    }

    // Fail if ALL sources errored
    if (sources_succeeded === 0) {
      throw new Error(
        `All 4 ingestion sources failed: ${error_details.map((d) => `${d.source}: ${d.error}`).join("; ")}`
      );
    }

    return {
      new_articles,
      duplicates_skipped,
      source_errors,
      sources_succeeded,
      sources_failed: results.length - sources_succeeded,
      error_details,
    };
  });
}

// ─── Step 2: Full Text Extraction ───────────────────────────────────────────

export async function step2FullText(): Promise<StepResult> {
  return runStep("fulltext", async () => {
    const { extractAllFullText } = await import("@/lib/discovery/fulltext");

    const result = await extractAllFullText(3 * 60 * 1000); // 3-minute budget

    // Fail only if we processed a large batch and got zero successes
    // (indicates systemic issue like network down, not just stale URLs from backlog)
    // Threshold of 50 avoids false positives from small batches of historically unfetchable articles
    if (result.processed >= 50 && result.successes === 0) {
      throw new Error(
        `Full text extraction got 0 successes out of ${result.processed} attempts — possible network issue`
      );
    }

    return {
      processed: result.processed,
      successes: result.successes,
      failures: result.failures,
      remaining: result.remaining,
      budget_exceeded: result.budget_exceeded,
    };
  });
}

// ─── Step 3: Enrichment ─────────────────────────────────────────────────────

export async function step3Enrich(): Promise<StepResult> {
  return runStep("enrichment", async () => {
    const { runEnrichmentBatch } = await import("@/lib/enrichment/pipeline");

    const TIME_BUDGET_MS = 8 * 60 * 1000; // 8 minutes
    const deadline = Date.now() + TIME_BUDGET_MS;

    let total_processed = 0;
    let total_errors = 0;
    let total_input_tokens = 0;
    let total_output_tokens = 0;
    let total_cost = 0;
    let total_entities_created = 0;
    let total_entities_matched = 0;
    let remaining = 0;
    let iterations = 0;

    while (Date.now() < deadline) {
      const batch = await runEnrichmentBatch();
      iterations++;

      total_processed += batch.articles_processed;
      total_errors += batch.errors;
      total_input_tokens += batch.input_tokens;
      total_output_tokens += batch.output_tokens;
      total_cost += batch.estimated_cost_usd;
      total_entities_created += batch.entities_created;
      total_entities_matched += batch.entities_matched;
      remaining = batch.total_remaining;

      // First batch failed entirely — abort
      if (iterations === 1 && batch.articles_processed === 0 && batch.errors > 0) {
        throw new Error(
          `First enrichment batch failed: 0 processed, ${batch.errors} errors`
        );
      }

      if (batch.done) break;

      // If no articles were processed and no errors, nothing left
      if (batch.articles_processed === 0 && batch.errors === 0) break;
    }

    return {
      total_processed,
      total_errors,
      total_input_tokens,
      total_output_tokens,
      estimated_cost_usd: Math.round(total_cost * 10000) / 10000,
      entities_created: total_entities_created,
      entities_matched: total_entities_matched,
      remaining,
      iterations,
      budget_exceeded: Date.now() >= deadline && remaining > 0,
    };
  });
}

// ─── Step 4: Digest Generation ──────────────────────────────────────────────

export async function step4Digest(): Promise<StepResult> {
  return runStep("digest", async () => {
    const pool = (await import("@/lib/db")).default;

    // Fetch all user profiles
    const usersResult = await pool.query(
      `SELECT id, name FROM user_profiles ORDER BY id`
    );
    const users = usersResult.rows as Array<{ id: string; name: string }>;

    if (users.length === 0) {
      return { users_found: 0, successes: 0, failures: 0, details: [] };
    }

    let successes = 0;
    let failures = 0;
    const details: Array<{ user_id: string; name: string; status: string; error?: string; story_count?: number }> = [];

    for (const user of users) {
      try {
        // Call the digest endpoint internally via fetch on localhost
        // This reuses all the existing logic (personalisation, web context, Claude)
        const port = process.env.PORT || "3000";
        const res = await fetch(
          `http://localhost:${port}/api/digest/generate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: user.id }),
          }
        );

        if (!res.ok) {
          const errBody = await res.text();
          throw new Error(`HTTP ${res.status}: ${errBody.slice(0, 200)}`);
        }

        const briefing = await res.json();
        successes++;
        details.push({
          user_id: user.id,
          name: user.name,
          status: "ok",
          story_count: briefing.stories?.length ?? 0,
        });

        console.log(`[pipeline:digest] ${user.name} (${user.id}): ${briefing.stories?.length ?? 0} stories`);
      } catch (err) {
        failures++;
        const message = err instanceof Error ? err.message : String(err);
        details.push({ user_id: user.id, name: user.name, status: "failed", error: message });
        console.error(`[pipeline:digest] ${user.name} (${user.id}) failed:`, message);
      }
    }

    // Fail only if ALL users failed
    if (successes === 0 && failures > 0) {
      throw new Error(`Digest generation failed for all ${failures} users`);
    }

    return { users_found: users.length, successes, failures, details };
  });
}
