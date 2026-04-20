/**
 * CLI: node --env-file=.env.local --experimental-strip-types scripts/learn/generate-concept-cards.ts [options]
 *
 * Promotes approved concept_card_candidates into concept_cards via Gemini
 * generation. Concurrency 3. Dedupe-group siblings are auto-rejected inside
 * `promote()` when a sibling is promoted first.
 *
 * Options:
 *   --limit <n>         Max candidates to promote this run (default 25).
 *   --source <source>   Filter by extraction_source (briefing_corpus | entity_registry | manual_seed | canonical_source).
 *   --dry-run           List what would run; no LLM calls, no DB writes.
 *
 * Gated on LEARN_GENERATION_ENABLED=true unless --dry-run.
 */
import {
  listPending,
  promote,
  GenerationRefusedError,
  GenerationFailedError,
} from "../../src/lib/learn/concept-cards/candidate-queue";
import type { ExtractionSource } from "../../src/lib/learn/types";

const CONCURRENCY = 3;
const VALID_SOURCES: ExtractionSource[] = [
  "briefing_corpus",
  "entity_registry",
  "manual_seed",
  "canonical_source",
];

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

const limitIdx = args.indexOf("--limit");
const limit =
  limitIdx !== -1 && args[limitIdx + 1]
    ? Math.max(1, parseInt(args[limitIdx + 1], 10))
    : 25;

const sourceIdx = args.indexOf("--source");
const sourceArg = sourceIdx !== -1 ? args[sourceIdx + 1] : undefined;
let sourceFilter: ExtractionSource | undefined;
if (sourceArg) {
  if (!VALID_SOURCES.includes(sourceArg as ExtractionSource)) {
    console.error(
      `[generate-concept-cards] Unknown --source: ${sourceArg}. Valid: ${VALID_SOURCES.join(", ")}`,
    );
    process.exit(1);
  }
  sourceFilter = sourceArg as ExtractionSource;
}

interface Outcome {
  candidateId: string;
  term: string;
  status: "generated" | "refused" | "failed";
  detail?: string;
  conceptCardId?: string;
}

(async () => {
  if (process.env.LEARN_GENERATION_ENABLED !== "true" && !dryRun) {
    console.error(
      "[generate-concept-cards] LEARN_GENERATION_ENABLED must be 'true' (or pass --dry-run).",
    );
    process.exit(1);
  }

  const pending = await listPending(limit, sourceFilter);
  console.log(
    `[generate-concept-cards] found ${pending.length} approved candidate(s)`,
    { limit, sourceFilter: sourceFilter ?? "(any)", dryRun },
  );

  if (pending.length === 0) {
    console.log("[generate-concept-cards] nothing to do");
    process.exit(0);
  }

  if (dryRun) {
    for (const c of pending) {
      console.log(
        `  [dry-run] ${c.extraction_source.padEnd(18)} ${c.term}${c.abbrev ? ` (${c.abbrev})` : ""}  signals=${c.signal_count}`,
      );
    }
    process.exit(0);
  }

  const outcomes: Outcome[] = [];

  for (let i = 0; i < pending.length; i += CONCURRENCY) {
    const batch = pending.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (c): Promise<Outcome> => {
        try {
          const { conceptCardId } = await promote(c.id);
          return {
            candidateId: c.id,
            term: c.term,
            status: "generated",
            conceptCardId,
          };
        } catch (err) {
          if (err instanceof GenerationRefusedError) {
            return {
              candidateId: c.id,
              term: c.term,
              status: "refused",
              detail: err.message,
            };
          }
          if (err instanceof GenerationFailedError) {
            return {
              candidateId: c.id,
              term: c.term,
              status: "failed",
              detail: err.message,
            };
          }
          return {
            candidateId: c.id,
            term: c.term,
            status: "failed",
            detail: String(err),
          };
        }
      }),
    );
    outcomes.push(...results);
    for (const o of results) {
      const prefix =
        o.status === "generated" ? "OK  " : o.status === "refused" ? "SKIP" : "FAIL";
      console.log(
        `  [${prefix}] ${o.term}${o.conceptCardId ? `  → ${o.conceptCardId}` : ""}${o.detail ? `  (${o.detail})` : ""}`,
      );
    }
  }

  const generated = outcomes.filter((o) => o.status === "generated").length;
  const refused = outcomes.filter((o) => o.status === "refused").length;
  const failed = outcomes.filter((o) => o.status === "failed").length;
  console.log(
    `[generate-concept-cards] complete: ${generated} generated, ${refused} refused, ${failed} failed`,
  );
  process.exit(failed > 0 && generated === 0 ? 1 : 0);
})().catch((err) => {
  console.error("[generate-concept-cards] fatal:", err);
  process.exit(1);
});
