// Workstream A — per-archetype daily variants.
// Generates one podcast variant per archetype (commercial, academic, public,
// general) on top of the existing global daily episode. Paid tiers only see
// their archetype variant via /api/podcast; free users fall back to global.

import pool from "@/lib/db";
import type { DigestOutput, ScoredStory } from "@/lib/types";
import { sydneyDateString } from "./date";
import {
  ALL_ARCHETYPES,
  ARCHETYPE_FRAMINGS,
  type PodcastArchetype,
} from "./archetypes";

export interface ArchetypeVariantResult {
  archetype: PodcastArchetype;
  status: "generated" | "skipped" | "failed";
  reason?: string;
  episode_id?: string;
}

async function generateOneArchetype(
  date: string,
  digest: DigestOutput,
  stories: ScoredStory[],
  archetype: PodcastArchetype,
  nemSummary: string | undefined
): Promise<ArchetypeVariantResult> {
  const existing = await pool.query(
    `SELECT id FROM podcast_episodes
     WHERE briefing_date = $1 AND tier = 'daily' AND archetype = $2 AND user_id IS NULL
     LIMIT 1`,
    [date, archetype]
  );
  if (existing.rows.length > 0) {
    return { archetype, status: "skipped", reason: "variant already exists" };
  }

  try {
    const { generatePodcastScript } = await import("./script-generator");
    const framing = ARCHETYPE_FRAMINGS[archetype];

    const archetypeBriefing: DigestOutput = {
      ...digest,
      narrative: `[${framing.short.toUpperCase()}] ${framing.directive}\n\n${digest.narrative ?? ""}`,
    };

    const script = await generatePodcastScript({
      digest: archetypeBriefing,
      stories,
      nemSummary,
    });

    const { synthesizePodcast } = await import("./tts-synthesizer");
    const { audioBuffer, durationSeconds, format } = await synthesizePodcast(script);

    const { storePodcastAudio, savePodcastEpisode } = await import("./storage");
    const audioUrl = await storePodcastAudio(audioBuffer, date, format, `daily-${archetype}`);

    const saved = await savePodcastEpisode({
      briefing_date: date,
      user_id: null,
      script,
      audio_url: audioUrl,
      audio_duration_seconds: durationSeconds,
      audio_size_bytes: audioBuffer.length,
      audio_format: format,
      model_tts: "gemini-2.5-flash-preview-tts",
      model_script: "claude-sonnet-4-20250514",
      generated_at: new Date().toISOString(),
      tier: "daily",
      archetype,
    });

    return { archetype, status: "generated", episode_id: saved.id };
  } catch (err) {
    return {
      archetype,
      status: "failed",
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function generateArchetypeDailyVariants(
  date?: string
): Promise<ArchetypeVariantResult[]> {
  const target = date ?? sydneyDateString();

  const briefing = await pool.query(
    `SELECT digest, stories FROM daily_briefings WHERE date = $1 ORDER BY generated_at DESC LIMIT 1`,
    [target]
  );
  if (briefing.rows.length === 0) {
    return ALL_ARCHETYPES.map((a) => ({
      archetype: a,
      status: "skipped" as const,
      reason: "no briefing found for date",
    }));
  }

  const digest = briefing.rows[0].digest as DigestOutput;
  const stories = (briefing.rows[0].stories ?? []) as ScoredStory[];

  let nemSummary: string | undefined;
  try {
    const { fetchEnergyDashboard } = await import("@/lib/energy/openelectricity");
    const nem = await fetchEnergyDashboard();
    nemSummary = `Renewables: ${nem.renewable_pct_today.toFixed(1)}%. Total generation (7d): ${nem.total_generation_gwh_7d.toFixed(0)} GWh.`;
  } catch {
    // optional
  }

  const results: ArchetypeVariantResult[] = [];
  for (const archetype of ALL_ARCHETYPES) {
    const result = await generateOneArchetype(target, digest, stories, archetype, nemSummary);
    results.push(result);
  }
  return results;
}
