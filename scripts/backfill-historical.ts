/**
 * Historical backfill — seed the pgvector corpus with 6-12 months of prior
 * climate/energy coverage via Google News RSS search.
 *
 * Runs three phases end-to-end and is fully resumable:
 *
 *   1. INGEST — fetch Google News for each (keyword group × week) window
 *      in the configured range, inserting into raw_articles with the
 *      standard URL + title_hash dedup.
 *   2. ENRICH — loop runEnrichmentBatch() until every raw_articles row
 *      has a matching enriched_articles row. Stage 1 + Stage 2 + embedding
 *      + contradicts_prior all happen inside that call.
 *   3. EMBED  — safety-net pass via backfillEmbeddings() for any articles
 *      whose inline embed failed during enrichment (rate-limited, timeout).
 *
 * Ingest progress is checkpointed to scripts/.backfill-state.json so a
 * crashed / Ctrl-C'd run can pick up where it left off.
 *
 * Usage (typical overnight run):
 *   npx tsx scripts/backfill-historical.ts --months=12
 *
 * Other flags:
 *   --months=N            How far back to go. Default 12.
 *   --window-days=N       Size of each RSS window. Default 7.
 *   --phase=all|ingest|enrich|embed
 *                         Run only one phase. Default 'all'.
 *   --per-request-ms=N    Throttle between Google News requests. Default 1200.
 *   --batch-pause-ms=N    Sleep between enrichment batches. Default 3000.
 *   --dry-run             Print the plan (windows, query counts) and exit.
 *   --reset-state         Wipe the checkpoint file before starting.
 *
 * Requires: DATABASE_URL, GOOGLE_AI_API_KEY in .env.local
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import fs from "fs";
import path from "path";

// ─── Config ────────────────────────────────────────────────────────────────

interface CliArgs {
  months: number;
  windowDays: number;
  phase: "all" | "ingest" | "enrich" | "embed";
  perRequestMs: number;
  batchPauseMs: number;
  dryRun: boolean;
  resetState: boolean;
}

function parseArgs(): CliArgs {
  const args: CliArgs = {
    months: 12,
    windowDays: 7,
    phase: "all",
    perRequestMs: 1200,
    batchPauseMs: 3000,
    dryRun: false,
    resetState: false,
  };
  for (const arg of process.argv.slice(2)) {
    const [rawKey, rawValue] = arg.split("=");
    const key = rawKey.replace(/^--/, "");
    const value = rawValue ?? "true";
    switch (key) {
      case "months":
        args.months = parseInt(value, 10);
        break;
      case "window-days":
        args.windowDays = parseInt(value, 10);
        break;
      case "phase":
        if (!["all", "ingest", "enrich", "embed"].includes(value)) {
          throw new Error(`Invalid --phase=${value}`);
        }
        args.phase = value as CliArgs["phase"];
        break;
      case "per-request-ms":
        args.perRequestMs = parseInt(value, 10);
        break;
      case "batch-pause-ms":
        args.batchPauseMs = parseInt(value, 10);
        break;
      case "dry-run":
        args.dryRun = value !== "false";
        break;
      case "reset-state":
        args.resetState = value !== "false";
        break;
      default:
        throw new Error(`Unknown flag: --${key}`);
    }
  }
  return args;
}

// ─── Checkpoint state ──────────────────────────────────────────────────────

interface CheckpointState {
  started_at: string;
  last_updated_at: string;
  config: { months: number; window_days: number };
  // Key: `${afterISO}:${beforeISO}:${groupIdx}` — presence means done.
  completed_windows: Record<
    string,
    {
      seen: number;
      inserted: number;
      url_duplicates: number;
      title_hash_duplicates: number;
      skipped_out_of_window: number;
      error?: string;
    }
  >;
}

const STATE_PATH = path.join(
  process.cwd(),
  "scripts",
  ".backfill-state.json"
);

function loadState(args: CliArgs): CheckpointState {
  if (args.resetState && fs.existsSync(STATE_PATH)) {
    fs.unlinkSync(STATE_PATH);
  }
  if (fs.existsSync(STATE_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(STATE_PATH, "utf8")) as CheckpointState;
    } catch {
      // corrupt — start fresh
    }
  }
  return {
    started_at: new Date().toISOString(),
    last_updated_at: new Date().toISOString(),
    config: { months: args.months, window_days: args.windowDays },
    completed_windows: {},
  };
}

function saveState(state: CheckpointState): void {
  state.last_updated_at = new Date().toISOString();
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

// ─── Utilities ─────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function fmtInt(n: number): string {
  return n.toLocaleString("en-AU");
}

function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h${m}m${sec}s`;
  if (m > 0) return `${m}m${sec}s`;
  return `${sec}s`;
}

// ─── Phase 1: Ingest ───────────────────────────────────────────────────────

async function phaseIngest(args: CliArgs, state: CheckpointState) {
  const { NEWSAPI_AI_QUERIES } = await import(
    "../src/lib/discovery/news-queries"
  );
  const {
    ensureGoogleNewsSource,
    fetchHistoricalWindow,
    makeWindows,
  } = await import("../src/lib/discovery/google-news-historical");

  await ensureGoogleNewsSource();

  const windows = makeWindows(args.months, args.windowDays);
  const totalRequests = windows.length * NEWSAPI_AI_QUERIES.length;
  console.log(
    `[ingest] ${windows.length} windows × ${NEWSAPI_AI_QUERIES.length} keyword groups = ${totalRequests} requests`
  );
  console.log(
    `[ingest] Range: ${windows[0]?.afterISO} → ${windows[windows.length - 1]?.beforeISO}`
  );

  if (args.dryRun) {
    console.log("[ingest] --dry-run set; skipping network/DB.");
    return;
  }

  const start = Date.now();
  let requestIdx = 0;
  let totals = {
    seen: 0,
    inserted: 0,
    url_duplicates: 0,
    title_hash_duplicates: 0,
    skipped_out_of_window: 0,
    errors: 0,
  };

  for (const window of windows) {
    for (let groupIdx = 0; groupIdx < NEWSAPI_AI_QUERIES.length; groupIdx++) {
      const key = `${window.afterISO}:${window.beforeISO}:${groupIdx}`;
      requestIdx++;

      if (state.completed_windows[key]) {
        continue;
      }

      const keywords = NEWSAPI_AI_QUERIES[groupIdx];
      const result = await fetchHistoricalWindow(keywords, window);

      totals.seen += result.seen;
      totals.inserted += result.inserted;
      totals.url_duplicates += result.url_duplicates;
      totals.title_hash_duplicates += result.title_hash_duplicates;
      totals.skipped_out_of_window += result.skipped_out_of_window;
      if (result.error) totals.errors++;

      state.completed_windows[key] = {
        seen: result.seen,
        inserted: result.inserted,
        url_duplicates: result.url_duplicates,
        title_hash_duplicates: result.title_hash_duplicates,
        skipped_out_of_window: result.skipped_out_of_window,
        error: result.error,
      };
      saveState(state);

      const elapsed = fmtDuration(Date.now() - start);
      const tag = result.error ? "ERR " : "ok  ";
      console.log(
        `[ingest ${requestIdx}/${totalRequests}] ${tag}${window.afterISO}→${window.beforeISO} g${groupIdx}  ` +
          `seen=${result.seen} +${result.inserted} url-dup=${result.url_duplicates} title-dup=${result.title_hash_duplicates}` +
          (result.error ? `  (${result.error.slice(0, 80)})` : "") +
          `  [${elapsed}]`
      );

      await sleep(args.perRequestMs);
    }
  }

  console.log(
    `\n[ingest] done in ${fmtDuration(Date.now() - start)}: ` +
      `seen=${fmtInt(totals.seen)} inserted=${fmtInt(totals.inserted)} ` +
      `url-dup=${fmtInt(totals.url_duplicates)} title-dup=${fmtInt(totals.title_hash_duplicates)} ` +
      `out-of-window=${fmtInt(totals.skipped_out_of_window)} errors=${totals.errors}`
  );
}

// ─── Phase 2: Enrich ───────────────────────────────────────────────────────

async function phaseEnrich(args: CliArgs) {
  const { runEnrichmentBatch } = await import(
    "../src/lib/enrichment/pipeline"
  );
  const { default: pool } = await import("../src/lib/db");

  // Report backlog before starting.
  const { rows: before } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM raw_articles ra
     LEFT JOIN enriched_articles ea ON ea.raw_article_id = ra.id
     WHERE ea.id IS NULL`
  );
  const initialBacklog = parseInt(before[0].count, 10);
  console.log(`[enrich] backlog: ${fmtInt(initialBacklog)} articles to enrich`);

  if (initialBacklog === 0) {
    console.log("[enrich] nothing to do.");
    return;
  }
  if (args.dryRun) {
    console.log("[enrich] --dry-run set; skipping.");
    return;
  }

  const start = Date.now();
  let batchNum = 0;
  let processedTotal = 0;
  let errorsTotal = 0;
  let inputTokensTotal = 0;
  let outputTokensTotal = 0;
  let costTotal = 0;

  while (true) {
    batchNum++;
    try {
      const r = await runEnrichmentBatch();
      processedTotal += r.articles_processed;
      errorsTotal += r.errors;
      inputTokensTotal += r.input_tokens;
      outputTokensTotal += r.output_tokens;
      costTotal += r.estimated_cost_usd;

      const elapsed = fmtDuration(Date.now() - start);
      console.log(
        `[enrich batch ${batchNum}] +${r.articles_processed} (errors=${r.errors})  ` +
          `remaining=${fmtInt(r.total_remaining)}  ` +
          `tokens in=${fmtInt(r.input_tokens)} out=${fmtInt(r.output_tokens)}  ` +
          `$${r.estimated_cost_usd.toFixed(4)} cum=$${costTotal.toFixed(2)}  ` +
          `[${elapsed}]`
      );

      if (r.done || r.articles_processed === 0) break;
    } catch (err) {
      console.error(`[enrich batch ${batchNum}] failed:`, err);
      errorsTotal++;
      // Back off a little longer on unexpected failures.
      await sleep(args.batchPauseMs * 3);
      continue;
    }

    await sleep(args.batchPauseMs);
  }

  console.log(
    `\n[enrich] done in ${fmtDuration(Date.now() - start)}: ` +
      `processed=${fmtInt(processedTotal)} errors=${errorsTotal} ` +
      `tokens in=${fmtInt(inputTokensTotal)} out=${fmtInt(outputTokensTotal)} ` +
      `cost=$${costTotal.toFixed(2)}`
  );
}

// ─── Phase 3: Embed (safety net) ───────────────────────────────────────────

async function phaseEmbed(args: CliArgs) {
  const { backfillEmbeddings } = await import(
    "../src/lib/intelligence/embedder"
  );

  if (args.dryRun) {
    console.log("[embed] --dry-run set; skipping.");
    return;
  }

  const start = Date.now();
  const stats = await backfillEmbeddings((type, done, total) => {
    if (done === total || done % 25 === 0) {
      console.log(
        `[embed] ${type}: ${done}/${total}  [${fmtDuration(Date.now() - start)}]`
      );
    }
  });

  console.log(
    `\n[embed] done in ${fmtDuration(Date.now() - start)}: ` +
      `articles=${stats.articles} podcasts=${stats.podcasts} ` +
      `daily=${stats.daily_digests} weekly=${stats.weekly_digests} ` +
      `reports=${stats.weekly_reports} chunks=${stats.total_chunks}`
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs();
  const state = loadState(args);

  console.log(
    `\nclimatepulse historical backfill  [phase=${args.phase}, months=${args.months}, window=${args.windowDays}d]\n`
  );

  if (args.phase === "all" || args.phase === "ingest") {
    await phaseIngest(args, state);
  }
  if (args.phase === "all" || args.phase === "enrich") {
    await phaseEnrich(args);
  }
  if (args.phase === "all" || args.phase === "embed") {
    await phaseEmbed(args);
  }

  console.log("\nbackfill complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("\nbackfill failed:", err);
  process.exit(1);
});
