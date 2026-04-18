import type { PodcastScript } from "@/lib/types";

export interface TTSSpeaker {
  /** Stable label used inside the transcript — the voice name from the provider (e.g. "Aoede"). */
  speakerLabel: string;
  /** Provider-specific voice ID (what Gemini expects in `prebuiltVoiceConfig.voiceName`). */
  providerVoiceId: string;
}

export interface TTSSynthesizeOptions {
  /** Map script speaker roles → TTS speaker config. Gemini supports up to 2 distinct speakers per call. */
  host: TTSSpeaker;
  analyst: TTSSpeaker;
  /** Optional override for the director-notes block prepended to the transcript. */
  directorNotes?: string;
}

export interface TTSResult {
  audioBuffer: Buffer;
  durationSeconds: number;
  format: string;
  model: string;
}

export interface TTSProvider {
  readonly name: string;
  synthesize(script: PodcastScript, opts: TTSSynthesizeOptions): Promise<TTSResult>;
}

// ─── Gemini multi-speaker provider ──────────────────────────────────────────

const GEMINI_TTS_MODEL = "gemini-2.5-flash-preview-tts";

function defaultDirectorNotes(host: TTSSpeaker, analyst: TTSSpeaker): string {
  return `[Audio Profile: Two professional broadcasters. Strong, natural delivery. Slightly faster than default pace — energetic and sharp, like a morning radio show. Not slow, not robotic.]
[Scene: Morning climate and energy podcast. Brisk, engaged, opinionated analysts stepping through the day's biggest stories.]
[Director's Notes: Speak at a natural-to-brisk pace — about 10% faster than typical reading speed. ${host.speakerLabel} is direct and incisive, occasionally sceptical. ${analyst.speakerLabel} is data-driven and precise. Both should sound energised and genuinely engaged — not slow or ponderous. Quick transitions between speakers. Emphasis on key numbers and implications.]

`;
}

function buildTranscript(
  script: PodcastScript,
  host: TTSSpeaker,
  analyst: TTSSpeaker,
  directorNotes?: string
): string {
  const header = directorNotes ?? defaultDirectorNotes(host, analyst);
  const turns = script.turns
    .map((turn, i) => {
      const label = turn.speaker === "host" ? host.speakerLabel : analyst.speakerLabel;
      const wordCount = turn.text.split(/\s+/).length;
      let pacing = "";
      if (wordCount <= 5) {
        pacing = " [quick, no pause before]";
      } else if (i > 0 && i % 5 === 0) {
        pacing = " [slightly slower, thoughtful]";
      } else if (wordCount > 40) {
        pacing = " [measured pace, emphasise numbers]";
      }
      return `${label}:${pacing} ${turn.text}`;
    })
    .join("\n\n");
  return header + turns;
}

function prependWavHeader(
  pcm: Buffer,
  sampleRate: number,
  bitsPerSample: number,
  channels: number
): Buffer {
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = channels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcm.length;
  const fileSize = 36 + dataSize;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(fileSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcm]);
}

export class GeminiMultiSpeakerProvider implements TTSProvider {
  readonly name = "gemini-multispeaker";

  async synthesize(script: PodcastScript, opts: TTSSynthesizeOptions): Promise<TTSResult> {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_AI_API_KEY not configured");

    const transcript = buildTranscript(script, opts.host, opts.analyst, opts.directorNotes);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TTS_MODEL}:generateContent?key=${apiKey}`;
    const body = {
      contents: [{ parts: [{ text: transcript }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: [
              {
                speaker: opts.host.speakerLabel,
                voiceConfig: { prebuiltVoiceConfig: { voiceName: opts.host.providerVoiceId } },
              },
              {
                speaker: opts.analyst.speakerLabel,
                voiceConfig: { prebuiltVoiceConfig: { voiceName: opts.analyst.providerVoiceId } },
              },
            ],
          },
        },
      },
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 240_000);
    const t0 = Date.now();
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    console.log(`[tts] Gemini responded in ${((Date.now() - t0) / 1000).toFixed(1)}s, status: ${response.status}`);

    if (!response.ok) {
      throw new Error(`Gemini TTS API error ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    const audioPart = data.candidates?.[0]?.content?.parts?.find(
      (p: { inlineData?: { mimeType: string; data: string } }) =>
        p.inlineData?.mimeType?.startsWith("audio/")
    );
    if (!audioPart?.inlineData?.data) {
      throw new Error("No audio data in Gemini TTS response");
    }

    const pcm = Buffer.from(audioPart.inlineData.data, "base64");
    const sampleRate = 24_000;
    const bitsPerSample = 16;
    const channels = 1;
    const wav = prependWavHeader(pcm, sampleRate, bitsPerSample, channels);
    const durationSeconds = Math.round(
      pcm.length / (sampleRate * (bitsPerSample / 8) * channels)
    );

    return { audioBuffer: wav, durationSeconds, format: "wav", model: GEMINI_TTS_MODEL };
  }
}

export const geminiProvider = new GeminiMultiSpeakerProvider();
