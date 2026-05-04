/**
 * Standalone podcast generation script.
 * Run with: npx tsx scripts/generate-podcast.ts [date]
 *
 * Bypasses the HTTP layer so there are no timeout issues
 * with long TTS generation calls.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import pg from "pg";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

const date = process.argv[2] ?? new Date().toISOString().split("T")[0];

const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://climatepulse:climatepulse@localhost:5432/climatepulse",
});

async function main() {
  // 1. Get digest
  const res = await pool.query(
    "SELECT digest, stories FROM daily_briefings WHERE date = $1 ORDER BY generated_at DESC LIMIT 1",
    [date]
  );
  if (res.rows.length === 0) throw new Error(`No briefing found for ${date}`);
  const digest = res.rows[0].digest;
  const stories = res.rows[0].stories ?? [];
  const storiesWithText = stories.filter((s: { full_text?: string }) => s.full_text);
  console.log(
    `Digest loaded: ${digest.hero_stories.length} heroes, ${digest.compact_stories.length} compact, ${storiesWithText.length}/${stories.length} with full text`
  );

  // Fetch NEM data
  let nemSummary: string | undefined;
  try {
    const nemRes = await fetch("http://localhost:3030/api/energy/dashboard");
    if (nemRes.ok) {
      const nem = await nemRes.json();
      nemSummary = `Renewables: ${nem.renewable_pct_today?.toFixed(1)}% of generation today. 7-day average: ${nem.renewable_pct_7d?.toFixed(1)}%. Total generation (7d): ${nem.total_generation_gwh_7d?.toFixed(0)} GWh.`;
      if (nem.price_summaries?.length > 0) {
        const prices = nem.price_summaries
          .filter((p: { avg_24h?: number | null }) => p.avg_24h != null)
          .map((p: { region: string; avg_24h: number }) => `${p.region} $${p.avg_24h.toFixed(0)}`)
          .join(", ");
        nemSummary += ` Spot prices (24h avg): ${prices}/MWh.`;
      }
      console.log("NEM data:", nemSummary);
    }
  } catch {
    console.log("NEM data unavailable (dev server not running?)");
  }

  // 2. Generate script
  console.log("Generating script...");
  console.time("script-gen");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  // Import and call script generator inline (avoid path alias issues)
  const scriptModule = await import("../src/lib/podcast/script-generator.js");
  const script = await scriptModule.generatePodcastScript({ digest, stories, nemSummary });
  console.timeEnd("script-gen");
  console.log(
    `Script: "${script.title}" | ${script.word_count} words | ${script.turns.length} turns`
  );

  // Print script preview
  console.log("\n--- SCRIPT ---");
  for (const turn of script.turns) {
    const label = turn.speaker === "host" ? "SARAH" : "JAMES";
    console.log(`[${label}] ${turn.text}`);
  }
  console.log("--- END SCRIPT ---\n");

  // 3. Synthesize audio
  console.log("Synthesizing audio (this may take 2-4 minutes)...");
  console.time("tts");
  const ttsModule = await import("../src/lib/podcast/tts-synthesizer.js");
  const { audioBuffer, durationSeconds, format } =
    await ttsModule.synthesizePodcast(script);
  console.timeEnd("tts");
  console.log(
    `Audio: ${durationSeconds}s, ${(audioBuffer.length / 1024 / 1024).toFixed(1)} MB, ${format}`
  );

  // 4. Save locally
  const dir = join(process.cwd(), "public", "podcasts");
  await mkdir(dir, { recursive: true });
  const filename = `${date}-global.${format}`;
  await writeFile(join(dir, filename), audioBuffer);
  console.log(`Saved to public/podcasts/${filename}`);

  // 5. Save to DB
  const id = `podcast-${Date.now()}`;
  await pool.query(
    `INSERT INTO podcast_episodes
       (id, briefing_date, user_id, script, audio_url, audio_duration_seconds,
        audio_size_bytes, audio_format, model_tts, model_script, generated_at)
     VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (briefing_date, user_id) DO UPDATE SET
       id = EXCLUDED.id, script = EXCLUDED.script, audio_url = EXCLUDED.audio_url,
       audio_duration_seconds = EXCLUDED.audio_duration_seconds,
       audio_size_bytes = EXCLUDED.audio_size_bytes, audio_format = EXCLUDED.audio_format,
       model_tts = EXCLUDED.model_tts, model_script = EXCLUDED.model_script,
       generated_at = EXCLUDED.generated_at`,
    [
      id, date, JSON.stringify(script), `/podcasts/${filename}`,
      durationSeconds, audioBuffer.length, format,
      "gemini-2.5-flash-preview-tts", "claude-sonnet-4-6",
      new Date().toISOString(),
    ]
  );
  console.log("Saved to DB");

  await pool.end();
  console.log("\nDone! Refresh the Intelligence tab to listen.");
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
