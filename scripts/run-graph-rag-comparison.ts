/**
 * Run the graph-RAG comparison harness across all backends and write the
 * raw results + CSV + summary to disk.
 *
 * Usage:
 *   npx tsx scripts/run-graph-rag-comparison.ts
 *   npx tsx scripts/run-graph-rag-comparison.ts --queries ew-01,mh-04
 *   npx tsx scripts/run-graph-rag-comparison.ts --backends pg-graph-walk
 *   npx tsx scripts/run-graph-rag-comparison.ts --hops 3 --confidence 0.7
 *   npx tsx scripts/run-graph-rag-comparison.ts --limit 5
 *
 * Output (timestamped, written to docs/graph-rag-spike/runs/):
 *   <timestamp>-results.json    Raw results
 *   <timestamp>-results.csv     Spreadsheet-ready, with relevance column to fill in
 *   <timestamp>-summary.txt     Per-backend latency + result-count summary
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import fs from "fs";
import path from "path";

interface CliOpts {
  queries?: string[];
  backends?: string[];
  hops?: 1 | 2 | 3;
  confidence?: number;
  limit?: number;
}

function parseArgs(): CliOpts {
  const args = process.argv.slice(2);
  const out: CliOpts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--queries" && args[i + 1]) {
      out.queries = args[++i].split(",").map((s) => s.trim()).filter(Boolean);
    } else if (args[i] === "--backends" && args[i + 1]) {
      out.backends = args[++i].split(",").map((s) => s.trim()).filter(Boolean);
    } else if (args[i] === "--hops" && args[i + 1]) {
      const h = parseInt(args[++i], 10);
      if (h === 1 || h === 2 || h === 3) out.hops = h;
    } else if (args[i] === "--confidence" && args[i + 1]) {
      out.confidence = parseFloat(args[++i]);
    } else if (args[i] === "--limit" && args[i + 1]) {
      out.limit = parseInt(args[++i], 10);
    }
  }
  return out;
}

async function main() {
  const opts = parseArgs();
  const { runComparison, reportToCSV, summariseByBackend } = await import(
    "../src/lib/intelligence/evaluation/harness"
  );

  console.log("Running graph-RAG comparison harness…");
  if (opts.queries) console.log(`  queries:    ${opts.queries.join(", ")}`);
  if (opts.backends) console.log(`  backends:   ${opts.backends.join(", ")}`);
  console.log(`  maxHops:    ${opts.hops ?? 2}`);
  console.log(`  minConf:    ${opts.confidence ?? 0.6}`);
  console.log(`  limit:      ${opts.limit ?? 10}`);
  console.log();

  const start = Date.now();
  const report = await runComparison({
    queryIds: opts.queries,
    backendNames: opts.backends,
    maxHops: opts.hops,
    minConfidence: opts.confidence,
    limit: opts.limit ?? 10,
  });
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  // Write outputs.
  const runDir = path.join(process.cwd(), "docs", "graph-rag-spike", "runs");
  fs.mkdirSync(runDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");

  const jsonPath = path.join(runDir, `${ts}-results.json`);
  const csvPath = path.join(runDir, `${ts}-results.csv`);
  const summaryPath = path.join(runDir, `${ts}-summary.txt`);

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(csvPath, reportToCSV(report));

  const summary = summariseByBackend(report);
  const summaryLines: string[] = [];
  summaryLines.push(`Graph-RAG comparison run — ${report.ranAt}`);
  summaryLines.push(`Total wall-clock: ${elapsed}s`);
  summaryLines.push(`Queries × backends: ${report.queryCount} × ${report.backendCount} = ${report.totalQueries}`);
  summaryLines.push(`Total errors: ${report.totalErrors}`);
  summaryLines.push("");
  summaryLines.push("Per-backend summary:");
  for (const s of summary) {
    summaryLines.push(
      `  ${s.name.padEnd(28)}  avg=${s.avgLatencyMs}ms p95=${s.p95LatencyMs}ms  errors=${s.totalErrors}/${s.totalQueries}  avg_results=${s.avgResultCount}`
    );
  }

  if (report.unresolvedSeeds.length > 0) {
    summaryLines.push("");
    summaryLines.push(`Unresolved seed entity names (${report.unresolvedSeeds.length} queries):`);
    for (const u of report.unresolvedSeeds) {
      summaryLines.push(`  ${u.queryId}: ${u.missing.join(", ")}`);
    }
    summaryLines.push("");
    summaryLines.push(
      "  → Add these as aliases to the relevant entities, OR accept that graph-walk degrades to vector-only for these queries."
    );
  }

  const summaryText = summaryLines.join("\n");
  fs.writeFileSync(summaryPath, summaryText);

  console.log(summaryText);
  console.log();
  console.log(`Wrote:`);
  console.log(`  ${jsonPath}`);
  console.log(`  ${csvPath}`);
  console.log(`  ${summaryPath}`);
  console.log();
  console.log(`Next step: open the CSV in a spreadsheet, hand-score the relevance_0_to_3 column,`);
  console.log(`then summarise winners/losers per category in docs/graph-rag-spike/03-comparison.md.`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Comparison run failed:", err);
  process.exit(1);
});
