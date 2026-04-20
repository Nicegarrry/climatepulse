/**
 * CLI: node --env-file=.env.local --experimental-strip-types scripts/learn/refresh-brief-blocks.ts [options]
 *
 * Options:
 *   --dry-run             Log what would run; no LLM calls.
 *   --block-type <type>   One block type only (e.g. current_state).
 *   --microsector <slug>  One microsector slug only.
 *
 * Gated on LEARN_GENERATION_ENABLED=true.
 */
import { scheduleRefresh } from "../../src/lib/learn/microsector-briefs/scheduler";
import { BlockType } from "../../src/lib/learn/microsector-briefs/types";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

const blockTypeIdx = args.indexOf("--block-type");
const blockTypeArg = blockTypeIdx !== -1 ? args[blockTypeIdx + 1] : undefined;

const microsectorIdx = args.indexOf("--microsector");
const microsectorArg = microsectorIdx !== -1 ? args[microsectorIdx + 1] : undefined;

let blockTypeFilter: BlockType | undefined;
if (blockTypeArg) {
  const valid = Object.values(BlockType) as string[];
  if (!valid.includes(blockTypeArg)) {
    console.error(
      `[refresh-brief-blocks] Unknown block type: ${blockTypeArg}. Valid: ${valid.join(", ")}`,
    );
    process.exit(1);
  }
  blockTypeFilter = blockTypeArg as BlockType;
}

(async () => {
  if (process.env.LEARN_GENERATION_ENABLED !== "true" && !dryRun) {
    console.error(
      "[refresh-brief-blocks] LEARN_GENERATION_ENABLED must be 'true' (or pass --dry-run).",
    );
    process.exit(1);
  }

  console.log("[refresh-brief-blocks] starting", {
    dryRun,
    blockTypeFilter,
    microsectorSlug: microsectorArg,
  });

  const result = await scheduleRefresh({
    dryRun,
    blockTypeFilter,
    microsectorSlug: microsectorArg,
  });

  console.log("[refresh-brief-blocks] complete:", result);
  process.exit(0);
})().catch((err) => {
  console.error("[refresh-brief-blocks] fatal:", err);
  process.exit(1);
});
