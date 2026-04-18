import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/supabase/server";
import type { DigestOutput } from "@/lib/types";

export const maxDuration = 300; // Script gen (~15s) + TTS (~2-3 min for 5-min episode)

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
    if (!isCron) {
      const auth = await requireAuth("admin");
      if ("error" in auth) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
      }
    }

    const body = await req.json().catch(() => ({}));
    const useMock = body.mock === true;
    const date = body.date ?? new Date().toISOString().split("T")[0];

    if (useMock) {
      const { MOCK_PODCAST_EPISODE } = await import("@/lib/mock-podcast");
      return NextResponse.json(MOCK_PODCAST_EPISODE);
    }

    // Fetch briefing with stories (for full text)
    const briefingResult = await pool.query(
      `SELECT digest, stories FROM daily_briefings WHERE date = $1 ORDER BY generated_at DESC LIMIT 1`,
      [date]
    );

    if (briefingResult.rows.length === 0) {
      return NextResponse.json(
        { error: `No briefing found for ${date}` },
        { status: 404 }
      );
    }

    // savePodcastEpisode no longer has ON CONFLICT after the variant migration,
    // so guard here against re-running for the same date.
    const existing = await pool.query(
      `SELECT id, briefing_date, user_id, script, audio_url,
              audio_duration_seconds, audio_size_bytes, audio_format, generated_at
         FROM podcast_episodes
         WHERE briefing_date = $1 AND tier = 'daily' AND user_id IS NULL
           AND archetype IS NULL
         LIMIT 1`,
      [date]
    );
    if (existing.rows.length > 0) {
      return NextResponse.json(existing.rows[0]);
    }

    const digest = briefingResult.rows[0].digest as DigestOutput;
    const stories = briefingResult.rows[0].stories ?? [];

    // Fetch NEM data
    let nemSummary: string | undefined;
    try {
      const { fetchEnergyDashboard } = await import("@/lib/energy/openelectricity");
      const nem = await fetchEnergyDashboard();
      nemSummary = `Renewables: ${nem.renewable_pct_today.toFixed(1)}% of generation today. 7-day average: ${nem.renewable_pct_7d.toFixed(1)}%. Total generation (7d): ${nem.total_generation_gwh_7d.toFixed(0)} GWh.`;
      if (nem.price_summaries?.length > 0) {
        const prices = nem.price_summaries
          .filter(p => p.avg_24h != null)
          .map(p => `${p.region} $${p.avg_24h!.toFixed(0)}`)
          .join(", ");
        nemSummary += ` Spot prices (24h avg): ${prices}/MWh.`;
      }
    } catch {
      // NEM data optional
    }

    // Generate script with full context
    const { generatePodcastScript } = await import("@/lib/podcast/script-generator");
    const script = await generatePodcastScript({ digest, stories, nemSummary });

    // Synthesize audio
    const { synthesizePodcast } = await import("@/lib/podcast/tts-synthesizer");
    const { audioBuffer, durationSeconds, format } = await synthesizePodcast(script);

    // Store audio + metadata
    const { storePodcastAudio, savePodcastEpisode } = await import("@/lib/podcast/storage");
    const audioUrl = await storePodcastAudio(audioBuffer, date, format);

    const episode = await savePodcastEpisode({
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
    });

    return NextResponse.json(episode);
  } catch (err) {
    console.error("Podcast generation error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
