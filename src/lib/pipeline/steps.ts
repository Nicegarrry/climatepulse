// src/lib/pipeline/steps.ts

import type { StepResult } from "./types";
import type { DigestOutput } from "@/lib/types";
import { sydneyDateString } from "@/lib/podcast/date";

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
            error_details.push({ source: labels[i], error: d.error ?? ("source" in d ? d.source : String(d)) });
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

    // 12 minutes — Vercel Pro serverless cap is 800s (~13m 20s); this leaves headroom
    // for the in-flight Gemini batch to finish before the function is killed.
    const TIME_BUDGET_MS = 12 * 60 * 1000;
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
    const { generateBriefingForUser } = await import("@/lib/digest/generate");

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
        // Direct call — no self-fetch, no auth round-trip.
        const briefing = await generateBriefingForUser(user.id);
        successes++;
        details.push({
          user_id: user.id,
          name: user.name,
          status: "ok",
          story_count: briefing.stories?.length ?? 0,
        });

        console.log(
          `[pipeline:digest] ${user.name} (${user.id}): ${briefing.stories?.length ?? 0} stories`
        );
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

// ─── Step 5: Podcast Generation ────────────────────────────────────────────

export async function step5Podcast(): Promise<StepResult> {
  return runStep("podcast", async () => {
    const pool = (await import("@/lib/db")).default;

    const today = sydneyDateString();

    // Check if podcast already exists for today
    const existing = await pool.query(
      `SELECT id FROM podcast_episodes WHERE briefing_date = $1 AND user_id IS NULL`,
      [today]
    );
    if (existing.rows.length > 0) {
      return { status: "skipped", reason: "podcast already exists for today" };
    }

    // Fetch today's briefing (digest + scored stories with full text)
    const briefingResult = await pool.query(
      `SELECT digest, stories FROM daily_briefings WHERE date = $1 ORDER BY generated_at DESC LIMIT 1`,
      [today]
    );
    if (briefingResult.rows.length === 0) {
      return { status: "skipped", reason: "no briefing found for today" };
    }

    const digest = briefingResult.rows[0].digest as DigestOutput;
    const stories = briefingResult.rows[0].stories ?? [];

    // Fetch NEM summary
    let nemSummary: string | undefined;
    try {
      const { fetchEnergyDashboard } = await import("@/lib/energy/openelectricity");
      const nem = await fetchEnergyDashboard();
      nemSummary = `Renewables: ${nem.renewable_pct_today.toFixed(1)}% of generation today. 7-day average: ${nem.renewable_pct_7d.toFixed(1)}%. Total generation (7d): ${nem.total_generation_gwh_7d.toFixed(0)} GWh.`;
      if (nem.price_summaries?.length > 0) {
        const prices = nem.price_summaries
          .filter(p => p.avg_24h != null)
          .map(p => `${p.region} $${p.avg_24h!.toFixed(0)}`)
          .join(", ");
        nemSummary += ` Spot prices (24h avg): ${prices}/MWh.`;
      }
    } catch {
      // NEM data is optional
    }

    // Generate script with full context
    const { generatePodcastScript } = await import("@/lib/podcast/script-generator");
    const script = await generatePodcastScript({ digest, stories, nemSummary });

    // Synthesize audio
    const { synthesizePodcast } = await import("@/lib/podcast/tts-synthesizer");
    const { audioBuffer, durationSeconds, format } = await synthesizePodcast(script);

    // Store audio file
    const { storePodcastAudio, savePodcastEpisode } = await import("@/lib/podcast/storage");
    const audioUrl = await storePodcastAudio(audioBuffer, today, format);

    // Persist metadata
    await savePodcastEpisode({
      briefing_date: today,
      user_id: null,
      script,
      audio_url: audioUrl,
      audio_duration_seconds: durationSeconds,
      audio_size_bytes: audioBuffer.length,
      audio_format: format,
      model_tts: "gemini-2.5-flash-preview-tts",
      model_script: "claude-sonnet-4-6",
      generated_at: new Date().toISOString(),
    });

    return {
      duration_seconds: durationSeconds,
      file_size_bytes: audioBuffer.length,
      format,
      word_count: script.word_count,
    };
  });
}
