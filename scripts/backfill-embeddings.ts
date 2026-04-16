/**
 * Backfill embeddings for all content types that don't yet have entries in content_embeddings.
 *
 * Usage: npx tsx scripts/backfill-embeddings.ts
 *
 * Requires: DATABASE_URL, GOOGLE_AI_API_KEY in .env.local
 *
 * Covers:
 *   - Source articles (enriched_articles)
 *   - Podcast episodes (podcast_episodes) — transcripts chunked if long
 *   - Daily digests (daily_briefings) — own editorial
 *   - Weekly digests (weekly_digests) — own editorial
 *   - Weekly reports (weekly_reports) — own editorial
 *
 * Chunked content (podcasts > ~500 tokens) produces multiple rows in content_embeddings.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  // Dynamic import: ensures dotenv has populated process.env before
  // embedder.ts imports db.ts which instantiates the pg Pool.
  const { backfillEmbeddings } = await import("../src/lib/intelligence/embedder");

  console.log("Starting unified content embedding backfill...\n");

  const startTime = Date.now();

  const stats = await backfillEmbeddings((type, done, total) => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`  [${type}] ${done}/${total}  (${elapsed}s)`);
  });

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nBackfill complete in ${duration}s:`);
  console.log(`  Articles:        ${stats.articles}`);
  console.log(`  Podcasts:        ${stats.podcasts}`);
  console.log(`  Daily digests:   ${stats.daily_digests}`);
  console.log(`  Weekly digests:  ${stats.weekly_digests}`);
  console.log(`  Weekly reports:  ${stats.weekly_reports}`);
  console.log(`  Total chunks:    ${stats.total_chunks}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
