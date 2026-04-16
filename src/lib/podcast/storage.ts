import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import pool from "@/lib/db";
import type { PodcastEpisode, PodcastScript } from "@/lib/types";

/**
 * Store podcast audio. Uses Vercel Blob in production,
 * falls back to local public/ directory in development.
 */
export async function storePodcastAudio(
  audioBuffer: Buffer,
  date: string,
  format: string
): Promise<string> {
  // Use Vercel Blob if token is available (production/preview)
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const pathname = `podcasts/${date}-global.${format}`;
    const blob = await put(pathname, audioBuffer, {
      access: "public",
      contentType: `audio/${format}`,
      addRandomSuffix: false,
      allowOverwrite: true,
      multipart: true,
    });
    return blob.url;
  }

  // Local dev: write to public/podcasts/ and serve as static file
  const dir = join(process.cwd(), "public", "podcasts");
  await mkdir(dir, { recursive: true });
  const filename = `${date}-global.${format}`;
  await writeFile(join(dir, filename), audioBuffer);
  return `/podcasts/${filename}`;
}

/**
 * Persist podcast episode metadata to the database.
 */
export async function savePodcastEpisode(episode: {
  briefing_date: string;
  user_id: string | null;
  script: PodcastScript;
  audio_url: string;
  audio_duration_seconds: number | null;
  audio_size_bytes: number | null;
  audio_format: string;
  model_tts?: string;
  model_script?: string;
  generation_cost_usd?: number;
  generated_at: string;
}): Promise<PodcastEpisode> {
  const id = `podcast-${Date.now()}`;

  await pool.query(
    `INSERT INTO podcast_episodes
       (id, briefing_date, user_id, script, audio_url, audio_duration_seconds,
        audio_size_bytes, audio_format, model_tts, model_script,
        generation_cost_usd, generated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (briefing_date, user_id) DO UPDATE SET
       id = EXCLUDED.id,
       script = EXCLUDED.script,
       audio_url = EXCLUDED.audio_url,
       audio_duration_seconds = EXCLUDED.audio_duration_seconds,
       audio_size_bytes = EXCLUDED.audio_size_bytes,
       audio_format = EXCLUDED.audio_format,
       model_tts = EXCLUDED.model_tts,
       model_script = EXCLUDED.model_script,
       generation_cost_usd = EXCLUDED.generation_cost_usd,
       generated_at = EXCLUDED.generated_at`,
    [
      id,
      episode.briefing_date,
      episode.user_id,
      JSON.stringify(episode.script),
      episode.audio_url,
      episode.audio_duration_seconds,
      episode.audio_size_bytes,
      episode.audio_format,
      episode.model_tts ?? null,
      episode.model_script ?? null,
      episode.generation_cost_usd ?? null,
      episode.generated_at,
    ]
  );

  // Embed the podcast transcript into the RAG corpus (own editorial, feedback loop)
  try {
    const { embedPodcastEpisode } = await import("@/lib/intelligence/embedder");
    await embedPodcastEpisode(id);
  } catch (embedErr) {
    console.warn("Failed to embed podcast episode:", embedErr);
  }

  return {
    id,
    ...episode,
  };
}

/**
 * Get today's podcast episode (global v1 — user_id IS NULL).
 */
export async function getTodaysPodcast(
  date?: string
): Promise<PodcastEpisode | null> {
  const targetDate = date ?? new Date().toISOString().split("T")[0];

  const result = await pool.query(
    `SELECT id, briefing_date, user_id, script, audio_url,
            audio_duration_seconds, audio_size_bytes, audio_format, generated_at
     FROM podcast_episodes
     WHERE briefing_date = $1 AND user_id IS NULL
     ORDER BY generated_at DESC
     LIMIT 1`,
    [targetDate]
  );

  if (result.rows.length === 0) return null;

  return rowToEpisode(result.rows[0]);
}

/**
 * Get the most recent podcast episode (any date).
 */
export async function getLatestPodcast(): Promise<PodcastEpisode | null> {
  const result = await pool.query(
    `SELECT id, briefing_date, user_id, script, audio_url,
            audio_duration_seconds, audio_size_bytes, audio_format, generated_at
     FROM podcast_episodes
     WHERE user_id IS NULL
     ORDER BY briefing_date DESC, generated_at DESC
     LIMIT 1`
  );

  if (result.rows.length === 0) return null;
  return rowToEpisode(result.rows[0]);
}

function rowToEpisode(row: Record<string, unknown>): PodcastEpisode {
  return {
    id: row.id as string,
    briefing_date: row.briefing_date as string,
    user_id: row.user_id as string | null,
    script: row.script as PodcastEpisode["script"],
    audio_url: row.audio_url as string,
    audio_duration_seconds: row.audio_duration_seconds as number | null,
    audio_size_bytes: row.audio_size_bytes as number | null,
    audio_format: row.audio_format as string,
    generated_at: row.generated_at as string,
  };
}
