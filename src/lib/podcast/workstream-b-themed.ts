// Workstream B — themed weekly deep-dives.
// Each themed episode is driven by a row in `themed_schedule` (day_of_week +
// domain_filter + cornerstone character). Runs daily; only generates when a
// themed row matches today and no episode already exists for that theme+date.

import pool from "@/lib/db";
import type { DigestOutput } from "@/lib/types";
import { sydneyDateString } from "./date";
import { fetchThemedRagContext } from "./rag-context";
import { getCharacter, getDefaultHosts, type PodcastCharacterWithVoice } from "./characters";

export interface ThemedScheduleRow {
  id: string;
  theme_slug: string;
  title: string;
  day_of_week: number;
  local_time: string;
  cornerstone_character_id: string | null;
  default_ensemble_ids: string[];
  domain_filter: string[];
  min_significance: number;
  prompt_template_path: string | null;
  enabled: boolean;
}

export interface ThemedRunResult {
  theme_slug: string;
  status: "generated" | "skipped" | "failed";
  reason?: string;
  episode_id?: string;
}

function sydneyDayOfWeek(): number {
  const d = new Date().toLocaleString("en-US", { timeZone: "Australia/Sydney", weekday: "short" });
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(d);
}

async function loadTodaysThemes(): Promise<ThemedScheduleRow[]> {
  const dow = sydneyDayOfWeek();
  if (dow < 0) return [];
  const { rows } = await pool.query<ThemedScheduleRow>(
    `SELECT id, theme_slug, title, day_of_week, local_time, cornerstone_character_id,
            default_ensemble_ids, domain_filter, min_significance, prompt_template_path, enabled
       FROM themed_schedule
       WHERE day_of_week = $1 AND enabled = TRUE`,
    [dow]
  );
  return rows;
}

async function generateForTheme(theme: ThemedScheduleRow, date: string): Promise<ThemedRunResult> {
  const existing = await pool.query(
    `SELECT id FROM podcast_episodes
     WHERE briefing_date = $1 AND tier = 'themed' AND theme_slug = $2 AND user_id IS NULL
     LIMIT 1`,
    [date, theme.theme_slug]
  );
  if (existing.rows.length > 0) {
    return { theme_slug: theme.theme_slug, status: "skipped", reason: "already exists" };
  }

  try {
    const cornerstone = theme.cornerstone_character_id
      ? await getCharacter(theme.cornerstone_character_id)
      : null;
    const defaultHosts = await getDefaultHosts("themed");
    const cast: PodcastCharacterWithVoice[] = cornerstone
      ? [cornerstone, defaultHosts[0] ?? defaultHosts[1]]
      : defaultHosts;

    if (cast.length < 2 || !cast[0]?.voice || !cast[1]?.voice) {
      return {
        theme_slug: theme.theme_slug,
        status: "failed",
        reason: "cast not fully configured (need 2 characters with voice profiles)",
      };
    }

    const ragContext = await fetchThemedRagContext(theme.title, { domains: theme.domain_filter });

    const articles = await pool.query(
      `SELECT ra.title, ra.article_url, ra.source_name, ea.significance_composite
         FROM enriched_articles ea
         JOIN raw_articles ra ON ra.id = ea.raw_article_id
         WHERE ea.significance_composite >= $1
           AND (
             $2::text[] IS NULL OR array_length($2::text[], 1) IS NULL
             OR EXISTS (
               SELECT 1 FROM taxonomy_microsectors tm
               JOIN taxonomy_sectors ts ON ts.id = tm.sector_id
               JOIN taxonomy_domains td ON td.id = ts.domain_id
               WHERE tm.id = ANY(ea.microsector_ids) AND td.slug = ANY($2::text[])
             )
           )
           AND ra.published_at >= NOW() - INTERVAL '7 days'
         ORDER BY ea.significance_composite DESC
         LIMIT 15`,
      [theme.min_significance, theme.domain_filter.length ? theme.domain_filter : null]
    );

    if (articles.rows.length === 0) {
      return {
        theme_slug: theme.theme_slug,
        status: "skipped",
        reason: "no qualifying articles for theme this week",
      };
    }

    // Reuse the existing daily-script generator. We build a themed DigestOutput
    // from the top qualifying articles + RAG context; Claude sees the theme
    // directive in the narrative field and treats the stories as hero material.
    const themedDigest: DigestOutput = {
      narrative:
        `[${theme.title.toUpperCase()}] ${theme.title} — weekly deep-dive. ` +
        `Treat this as a 10–15 minute themed episode anchored by ${cast[0].display_name}. ` +
        `Focus on trend, cumulative weekly impact, and cross-story synthesis rather than headline recap.` +
        (ragContext.block ? `\n\n${ragContext.block}` : ""),
      daily_number: {
        value: "—",
        label: theme.title,
        context: `Themed deep-dive: ${theme.title}`,
        trend: null,
      },
      hero_stories: articles.rows.slice(0, 4).map((a: Record<string, unknown>, idx: number) => ({
        rank: idx + 1,
        headline: String(a.title),
        source: (a.source_name as string) ?? "",
        url: (a.article_url as string) ?? "",
        expert_take: "",
        key_metric: null,
        so_what: null,
        connected_storyline: null,
        micro_sectors: [],
        entities_mentioned: [],
      })),
      compact_stories: articles.rows.slice(4, 15).map((a: Record<string, unknown>, idx: number) => ({
        rank: idx + 5,
        headline: String(a.title),
        source: (a.source_name as string) ?? "",
        url: (a.article_url as string) ?? "",
        one_line_take: "",
        key_metric: null,
      })),
      cross_story_connections: null,
    };

    const { generatePodcastScript } = await import("./script-generator");
    const script = await generatePodcastScript({ digest: themedDigest });

    const { synthesizePodcast } = await import("./tts-synthesizer");
    const { audioBuffer, durationSeconds, format } = await synthesizePodcast(script);

    const { storePodcastAudio, savePodcastEpisode } = await import("./storage");
    const audioUrl = await storePodcastAudio(audioBuffer, date, format, `themed-${theme.theme_slug}`);

    const saved = await savePodcastEpisode({
      briefing_date: date,
      user_id: null,
      script,
      audio_url: audioUrl,
      audio_duration_seconds: durationSeconds,
      audio_size_bytes: audioBuffer.length,
      audio_format: format,
      model_tts: "gemini-2.5-flash-preview-tts",
      model_script: "claude-sonnet-4-6",
      generated_at: new Date().toISOString(),
      tier: "themed",
      theme_slug: theme.theme_slug,
      character_ids: cast.map((c) => c.id),
    });

    return { theme_slug: theme.theme_slug, status: "generated", episode_id: saved.id };
  } catch (err) {
    return {
      theme_slug: theme.theme_slug,
      status: "failed",
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function runThemedPodcastsForToday(
  date?: string
): Promise<ThemedRunResult[]> {
  const target = date ?? sydneyDateString();
  const themes = await loadTodaysThemes();
  const results: ThemedRunResult[] = [];
  for (const theme of themes) {
    results.push(await generateForTheme(theme, target));
  }
  return results;
}
