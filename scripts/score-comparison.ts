/**
 * Aggregate hand-scored relevance from a graph-RAG comparison CSV.
 *
 * Reads `relevance_0_to_3` per row, computes per-backend, per-category, and
 * per-query summaries, and emits markdown tables suitable for pasting into
 * 03-comparison.md / 04-recommendation.md.
 *
 * Usage:
 *   npx tsx scripts/score-comparison.ts <scored-csv-path>
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
  relevance: number | null; // null = unscored
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

function parseCSV(filePath: string): Row[] {
  const raw = fs.readFileSync(filePath, "utf-8");
  // Split on \n but respect \r\n line endings; also handle Mac Numbers' literal line endings
  const lines = raw.split(/\r?\n/);
  const header = parseCSVLine(lines[0]);
  const idx = (name: string) => header.indexOf(name);
  const i = {
    queryId: idx("query_id"),
    category: idx("category"),
    backend: idx("backend"),
    rank: idx("rank"),
    sourceId: idx("source_id"),
    title: idx("title"),
    relevance: idx("relevance_0_to_3"),
  };

  const rows: Row[] = [];
  for (let li = 1; li < lines.length; li++) {
    const line = lines[li];
    if (!line.trim()) continue;
    const cells = parseCSVLine(line);
    if (cells.length < header.length) continue;
    const relRaw = (cells[i.relevance] || "").trim();
    let relevance: number | null = null;
    if (relRaw !== "") {
      const n = Number(relRaw);
      if (!Number.isNaN(n) && n >= 0 && n <= 3) relevance = n;
    }
    rows.push({
      queryId: cells[i.queryId],
      category: cells[i.category],
      backend: cells[i.backend],
      rank: parseInt(cells[i.rank], 10),
      sourceId: cells[i.sourceId],
      title: cells[i.title],
      relevance,
    });
  }
  return rows;
}

function meanOrNA(values: number[]): string {
  if (values.length === 0) return "—";
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  return m.toFixed(2);
}

function main() {
  const csvPath = process.argv[2];
  if (!csvPath || !fs.existsSync(csvPath)) {
    console.error("Usage: npx tsx scripts/score-comparison.ts <scored-csv>");
    process.exit(1);
  }

  const rows = parseCSV(path.resolve(csvPath));

  // Group by (queryId, backend) → ranked rows
  const byQB = new Map<string, Row[]>();
  for (const r of rows) {
    const key = `${r.queryId}|${r.backend}`;
    if (!byQB.has(key)) byQB.set(key, []);
    byQB.get(key)!.push(r);
  }
  for (const v of byQB.values()) v.sort((a, b) => a.rank - b.rank);

  // Per-(query,backend) mean@3 / mean@5 (only over scored cells)
  interface QBStat {
    queryId: string;
    category: string;
    backend: string;
    scoredAt3: number;
    mean3: number | null;
    scoredAt5: number;
    mean5: number | null;
  }
  const qbStats: QBStat[] = [];
  for (const [key, list] of byQB) {
    const [queryId, backend] = key.split("|");
    const category = list[0]?.category ?? "";
    const top3 = list.filter((r) => r.rank <= 3 && r.relevance != null);
    const top5 = list.filter((r) => r.rank <= 5 && r.relevance != null);
    qbStats.push({
      queryId,
      category,
      backend,
      scoredAt3: top3.length,
      mean3: top3.length > 0 ? top3.reduce((a, b) => a + (b.relevance ?? 0), 0) / top3.length : null,
      scoredAt5: top5.length,
      mean5: top5.length > 0 ? top5.reduce((a, b) => a + (b.relevance ?? 0), 0) / top5.length : null,
    });
  }

  // Coverage report
  const totalRows = rows.length;
  const scoredRows = rows.filter((r) => r.relevance != null).length;
  const queriesWithAnyScore = new Set<string>();
  for (const s of qbStats) {
    if (s.scoredAt3 > 0) queriesWithAnyScore.add(`${s.queryId}|${s.backend}`);
  }

  // Per-category mean (averaging over query/backend cells that have at least one scored row in top-3)
  const categories = ["entity_walk", "thematic", "multi_hop", "contradiction", "calibration"];
  const backends = ["pgvector-only", "pgvector-cooccurrence", "pg-graph-walk"];

  console.log(`# Hand-scored relevance — ${path.basename(csvPath)}\n`);
  console.log(`## Coverage\n`);
  console.log(`- Total result rows in CSV: ${totalRows}`);
  console.log(`- Scored rows (relevance 0-3 set): **${scoredRows}**`);
  console.log(`- Query × backend cells with ≥1 scored top-3 result: ${queriesWithAnyScore.size} of ${qbStats.length}\n`);

  // Per-backend summary
  console.log(`## Per-backend summary (mean relevance over all scored top-K cells)\n`);
  console.log(`| Backend | Mean @3 | Mean @5 | Cells scored @3 |`);
  console.log(`|---|---|---|---|`);
  for (const b of backends) {
    const cells3 = qbStats.filter((s) => s.backend === b && s.mean3 != null);
    const cells5 = qbStats.filter((s) => s.backend === b && s.mean5 != null);
    const m3 = meanOrNA(cells3.map((c) => c.mean3!));
    const m5 = meanOrNA(cells5.map((c) => c.mean5!));
    console.log(`| ${b} | ${m3} | ${m5} | ${cells3.length} |`);
  }
  console.log("");

  // Per-category × backend
  console.log(`## Per-category × backend (mean @3)\n`);
  console.log(`| Category | pgvector-only | pgvector-cooccurrence | pg-graph-walk | Winner | Margin |`);
  console.log(`|---|---|---|---|---|---|`);
  for (const cat of categories) {
    const byB: Record<string, number[]> = {
      "pgvector-only": [],
      "pgvector-cooccurrence": [],
      "pg-graph-walk": [],
    };
    for (const s of qbStats) {
      if (s.category !== cat) continue;
      if (s.mean3 == null) continue;
      byB[s.backend].push(s.mean3);
    }
    const means = backends.map((b) => ({
      b,
      m: byB[b].length > 0 ? byB[b].reduce((a, x) => a + x, 0) / byB[b].length : null,
    }));
    const cells = backends.map((b) => meanOrNA(byB[b]));
    const valid = means.filter((x) => x.m != null) as { b: string; m: number }[];
    let winner = "—";
    let margin = "—";
    if (valid.length > 0) {
      valid.sort((a, b) => b.m - a.m);
      winner = valid[0].b;
      margin = valid.length > 1 ? (valid[0].m - valid[1].m).toFixed(2) : "n/a";
      // If multiple backends tie at the top, show "tie"
      if (valid.length > 1 && Math.abs(valid[0].m - valid[1].m) < 0.005) {
        winner = "tie";
      }
    }
    console.log(`| ${cat} | ${cells[0]} | ${cells[1]} | ${cells[2]} | ${winner} | ${margin} |`);
  }
  console.log("");

  // Pairwise: graph-walk vs pgvector-only on queries where BOTH backends were scored
  console.log(`## Head-to-head: pg-graph-walk vs pgvector-only (paired query@3)\n`);
  const paired: { queryId: string; category: string; pg: number; gw: number; delta: number }[] = [];
  for (const queryId of new Set(qbStats.map((s) => s.queryId))) {
    const pg = qbStats.find((s) => s.queryId === queryId && s.backend === "pgvector-only");
    const gw = qbStats.find((s) => s.queryId === queryId && s.backend === "pg-graph-walk");
    if (!pg || !gw || pg.mean3 == null || gw.mean3 == null) continue;
    paired.push({
      queryId,
      category: pg.category,
      pg: pg.mean3,
      gw: gw.mean3,
      delta: gw.mean3 - pg.mean3,
    });
  }
  paired.sort((a, b) => b.delta - a.delta);
  if (paired.length === 0) {
    console.log(`(No paired queries — neither backend has scored cells where both were scored.)\n`);
  } else {
    console.log(`Paired comparisons available: **${paired.length}** queries\n`);
    const wins = paired.filter((p) => p.delta > 0.05).length;
    const losses = paired.filter((p) => p.delta < -0.05).length;
    const ties = paired.length - wins - losses;
    console.log(`- graph-walk wins (Δ > +0.05): **${wins}**`);
    console.log(`- graph-walk loses (Δ < −0.05): **${losses}**`);
    console.log(`- ties (|Δ| ≤ 0.05): ${ties}\n`);
    console.log(`### Paired queries, sorted by graph-walk advantage\n`);
    console.log(`| Query | Category | pgvector @3 | graph-walk @3 | Δ |`);
    console.log(`|---|---|---|---|---|`);
    for (const p of paired) {
      const arrow = p.delta > 0.05 ? "🟢" : p.delta < -0.05 ? "🔴" : "—";
      console.log(
        `| ${p.queryId} | ${p.category} | ${p.pg.toFixed(2)} | ${p.gw.toFixed(2)} | ${arrow} ${p.delta >= 0 ? "+" : ""}${p.delta.toFixed(2)} |`
      );
    }
    console.log("");
  }

  // Top-1 relevance — what does each backend put first?
  console.log(`## Top-1 relevance by backend (queries where the top-1 was scored)\n`);
  console.log(`| Backend | Mean top-1 score | Top-1 cells scored |`);
  console.log(`|---|---|---|`);
  for (const b of backends) {
    const top1Vals: number[] = [];
    for (const [, list] of byQB) {
      const first = list.find((r) => r.rank === 1);
      if (first && first.backend === b && first.relevance != null) {
        top1Vals.push(first.relevance);
      }
    }
    console.log(`| ${b} | ${meanOrNA(top1Vals)} | ${top1Vals.length} |`);
  }
  console.log("");
}

main();
