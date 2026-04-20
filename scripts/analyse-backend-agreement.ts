/**
 * Compute backend-agreement statistics from a graph-RAG harness run.
 *
 * For each query, look at the top-K source_ids per backend and classify:
 *   - identical:  all 3 backends returned the same top-K set
 *   - overlap:    backends share some but not all top-K
 *   - divergent:  zero overlap between at least two backend pairs
 *
 * Output: a markdown table summarising which queries are worth hand-scoring.
 *
 * Usage:
 *   npx tsx scripts/analyse-backend-agreement.ts <results.csv> [--top 3]
 */

import fs from "fs";
import path from "path";

interface Row {
  queryId: string;
  category: string;
  backend: string;
  rank: number;
  sourceId: string;
  title: string;
  combinedScore: number;
  graphHops: string;
}

function parseCSV(filePath: string): Row[] {
  const raw = fs.readFileSync(filePath, "utf-8");
  const lines = raw.split("\n");
  const header = lines[0].split(",");
  const idx = (name: string) => header.indexOf(name);
  const i = {
    queryId: idx("query_id"),
    category: idx("category"),
    backend: idx("backend"),
    rank: idx("rank"),
    sourceId: idx("source_id"),
    title: idx("title"),
    combinedScore: idx("combined_score"),
    graphHops: idx("graph_hops"),
  };

  const rows: Row[] = [];
  for (let li = 1; li < lines.length; li++) {
    const line = lines[li];
    if (!line.trim()) continue;
    const cells = parseCSVLine(line);
    if (cells.length < header.length) continue;
    rows.push({
      queryId: cells[i.queryId],
      category: cells[i.category],
      backend: cells[i.backend],
      rank: parseInt(cells[i.rank], 10),
      sourceId: cells[i.sourceId],
      title: cells[i.title],
      combinedScore: parseFloat(cells[i.combinedScore] || "0"),
      graphHops: cells[i.graphHops] || "",
    });
  }
  return rows;
}

function parseCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

function jaccardOverlap(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const x of setA) if (setB.has(x)) intersection++;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

function main() {
  const args = process.argv.slice(2);
  const csvPath = args.find((a) => a.endsWith(".csv"));
  const topIdx = args.indexOf("--top");
  const top = topIdx >= 0 ? parseInt(args[topIdx + 1], 10) : 3;

  if (!csvPath || !fs.existsSync(csvPath)) {
    console.error("Usage: npx tsx scripts/analyse-backend-agreement.ts <results.csv> [--top N]");
    process.exit(1);
  }

  const rows = parseCSV(path.resolve(csvPath));

  // Group by (queryId, backend) → ordered list of sourceIds (top-K)
  const map = new Map<string, Map<string, Row[]>>();
  for (const r of rows) {
    if (!map.has(r.queryId)) map.set(r.queryId, new Map());
    const byBackend = map.get(r.queryId)!;
    if (!byBackend.has(r.backend)) byBackend.set(r.backend, []);
    byBackend.get(r.backend)!.push(r);
  }

  const queryIds = Array.from(map.keys()).sort();
  const summary: {
    queryId: string;
    category: string;
    cls: "identical" | "overlap" | "divergent";
    pgVsCo: number;
    pgVsGw: number;
    coVsGw: number;
    backends: Record<string, string[]>;
  }[] = [];

  let identical = 0;
  let overlap = 0;
  let divergent = 0;

  for (const qid of queryIds) {
    const byBackend = map.get(qid)!;
    const category = Array.from(byBackend.values())[0]?.[0]?.category ?? "";

    const topPg = (byBackend.get("pgvector-only") ?? [])
      .filter((r) => r.rank <= top && r.sourceId)
      .sort((a, b) => a.rank - b.rank)
      .map((r) => r.sourceId);
    const topCo = (byBackend.get("pgvector-cooccurrence") ?? [])
      .filter((r) => r.rank <= top && r.sourceId)
      .sort((a, b) => a.rank - b.rank)
      .map((r) => r.sourceId);
    const topGw = (byBackend.get("pg-graph-walk") ?? [])
      .filter((r) => r.rank <= top && r.sourceId)
      .sort((a, b) => a.rank - b.rank)
      .map((r) => r.sourceId);

    const pgVsCo = jaccardOverlap(topPg, topCo);
    const pgVsGw = jaccardOverlap(topPg, topGw);
    const coVsGw = jaccardOverlap(topCo, topGw);

    let cls: "identical" | "overlap" | "divergent";
    if (pgVsCo === 1 && pgVsGw === 1 && coVsGw === 1) {
      cls = "identical";
      identical++;
    } else if (Math.min(pgVsCo, pgVsGw, coVsGw) === 0) {
      cls = "divergent";
      divergent++;
    } else {
      cls = "overlap";
      overlap++;
    }

    summary.push({
      queryId: qid,
      category,
      cls,
      pgVsCo,
      pgVsGw,
      coVsGw,
      backends: { pgvector: topPg, cooccurrence: topCo, graphWalk: topGw },
    });
  }

  // Print markdown
  const lines: string[] = [];
  lines.push(`# Backend agreement analysis (top-${top})`);
  lines.push("");
  lines.push(
    `Total queries: ${queryIds.length} · identical=${identical} · overlap=${overlap} · divergent=${divergent}`
  );
  lines.push("");
  lines.push("## Per-query summary");
  lines.push("");
  lines.push(
    "| Query | Category | Class | pgvector vs cooccurrence | pgvector vs graph-walk | cooccurrence vs graph-walk |"
  );
  lines.push("|---|---|---|---|---|---|");
  for (const s of summary) {
    const flag =
      s.cls === "divergent" ? "🔴" : s.cls === "overlap" ? "🟡" : "🟢";
    lines.push(
      `| ${s.queryId} | ${s.category} | ${flag} ${s.cls} | ${s.pgVsCo.toFixed(2)} | ${s.pgVsGw.toFixed(2)} | ${s.coVsGw.toFixed(2)} |`
    );
  }

  lines.push("");
  lines.push("## Score these first (divergent + overlap cases)");
  lines.push("");
  lines.push(
    "These are the queries where the backend choice would change what the user sees. Score top-3 per backend on these to get the maximum information per row."
  );
  lines.push("");
  for (const s of summary) {
    if (s.cls === "identical") continue;
    lines.push(`### ${s.queryId} (${s.category}, ${s.cls})`);
    lines.push("");
    lines.push("| Backend | top-3 source_ids |");
    lines.push("|---|---|");
    lines.push(`| pgvector-only | ${s.backends.pgvector.join(", ") || "—"} |`);
    lines.push(`| pgvector-cooccurrence | ${s.backends.cooccurrence.join(", ") || "—"} |`);
    lines.push(`| pg-graph-walk | ${s.backends.graphWalk.join(", ") || "—"} |`);
    lines.push("");
  }

  lines.push("## Identical queries (skip — no signal in scoring)");
  lines.push("");
  for (const s of summary) {
    if (s.cls !== "identical") continue;
    lines.push(`- ${s.queryId} (${s.category})`);
  }

  console.log(lines.join("\n"));
}

main();
