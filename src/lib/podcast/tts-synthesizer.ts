import type { PodcastScript } from "@/lib/types";
import { geminiProvider } from "./tts-provider";

// Default daily voice pair — preserves existing v1 behaviour. Multi-variant
// callers (themed, flagship, archetype variants) should use geminiProvider
// directly with explicit voice profiles instead of this shim.
const DEFAULT_HOST = { speakerLabel: "Aoede", providerVoiceId: "Aoede" } as const;
const DEFAULT_ANALYST = { speakerLabel: "Charon", providerVoiceId: "Charon" } as const;

/**
 * Synthesize a podcast script into audio using Gemini TTS.
 * Backwards-compatible shim over the new TTSProvider interface.
 */
export async function synthesizePodcast(
  script: PodcastScript
): Promise<{ audioBuffer: Buffer; durationSeconds: number; format: string }> {
  const wordCount = script.turns.reduce((sum, t) => sum + t.text.split(/\s+/).length, 0);
  console.log(`[tts] Starting synthesis: ${wordCount} words, ${script.turns.length} turns`);

  const { audioBuffer, durationSeconds, format } = await geminiProvider.synthesize(script, {
    host: DEFAULT_HOST,
    analyst: DEFAULT_ANALYST,
  });

  return { audioBuffer, durationSeconds, format };
}
