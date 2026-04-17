// Backfill: run checkContradictsPrior on every already-enriched article so
// the flag is populated retroactively. Safe to re-run — the check only
// updates rows that actually match the heuristic.
//
// Usage: npx tsx scripts/backfill-contradicts-prior.ts

import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { default: pool } = await import("../src/lib/db");
  const { checkContradictsPrior } = await import(
    "../src/lib/enrichment/contradicts-prior"
  );

  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM enriched_articles ORDER BY enriched_at DESC`
  );

  console.log(`Checking ${rows.length} enriched articles...`);

  let flagged = 0;
  for (let i = 0; i < rows.length; i++) {
    try {
      const result = await checkContradictsPrior(rows[i].id);
      if (result.flagged) flagged++;
    } catch (err) {
      console.warn(`Failed ${rows[i].id}:`, err);
    }
    if ((i + 1) % 25 === 0) {
      console.log(`  ${i + 1}/${rows.length} done (${flagged} flagged)`);
    }
  }

  console.log(`\n=== Backfill complete ===`);
  console.log(`  checked: ${rows.length}`);
  console.log(`  flagged: ${flagged}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
