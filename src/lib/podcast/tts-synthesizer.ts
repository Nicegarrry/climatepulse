import type { PodcastScript } from "@/lib/types";
import { Mp3Encoder } from "@breezystack/lamejs";

// Voice assignments — distinct male/female pairing for clear speaker separation
const VOICES = {
  host: "Aoede",        // Feminine, breezy/warm — big-picture thinker "Sarah"
  analyst: "Charon",    // Masculine, informative — numbers/data person "James"
} as const;

const TTS_MODEL = "gemini-2.5-flash-preview-tts";

/**
 * Synthesize a podcast script into audio using Gemini TTS.
 * Returns an MP3 buffer — encoded from the 24 kHz PCM Gemini returns so
 * mobile playback starts quickly over cellular.
 */
export async function synthesizePodcast(
  script: PodcastScript
): Promise<{ audioBuffer: Buffer; durationSeconds: number; format: string }> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY not configured");

  // Build the multi-speaker transcript with director's notes
  const transcript = buildTranscript(script);
  const wordCount = script.turns.reduce((sum, t) => sum + t.text.split(/\s+/).length, 0);
  console.log(`[tts] Starting synthesis: ${wordCount} words, ${script.turns.length} turns`);

  // Call Gemini TTS via REST API (the JS SDK may not expose TTS methods)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        parts: [{ text: transcript }],
      },
    ],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        multiSpeakerVoiceConfig: {
          speakerVoiceConfigs: [
            {
              speaker: VOICES.host,
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: VOICES.host },
              },
            },
            {
              speaker: VOICES.analyst,
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: VOICES.analyst },
              },
            },
          ],
        },
      },
    },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 240_000); // 4 min timeout

  const t0 = Date.now();
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: controller.signal,
  });
  clearTimeout(timeout);
  console.log(`[tts] API responded in ${((Date.now() - t0) / 1000).toFixed(1)}s, status: ${response.status}`);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini TTS API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();

  // Extract audio data from response
  const audioPart = data.candidates?.[0]?.content?.parts?.find(
    (p: { inlineData?: { mimeType: string; data: string } }) => p.inlineData?.mimeType?.startsWith("audio/")
  );

  if (!audioPart?.inlineData?.data) {
    throw new Error("No audio data in Gemini TTS response");
  }

  const pcmBuffer = Buffer.from(audioPart.inlineData.data, "base64");

  const sampleRate = 24000;
  const bitsPerSample = 16;
  const channels = 1;
  const bytesPerSample = bitsPerSample / 8;

  const durationSeconds = Math.round(
    pcmBuffer.length / (sampleRate * bytesPerSample * channels)
  );

  // Encode to MP3 — WAV was ~48 KB/s (14 MB for 5 min) which made first-tap
  // playback slow on mobile. MP3 mono 64kbps is ~8 KB/s (2.4 MB for 5 min)
  // with no perceptible speech-quality loss at 24 kHz source.
  const mp3Buffer = pcmToMp3(pcmBuffer, sampleRate, channels);
  console.log(
    `[tts] Encoded ${(pcmBuffer.length / 1024 / 1024).toFixed(1)}MB PCM → ${(mp3Buffer.length / 1024 / 1024).toFixed(1)}MB MP3`
  );

  return { audioBuffer: mp3Buffer, durationSeconds, format: "mp3" };
}

function pcmToMp3(pcm: Buffer, sampleRate: number, channels: number): Buffer {
  // 64 kbps mono — transparent for speech at 24 kHz source.
  const encoder = new Mp3Encoder(channels, sampleRate, 64);

  const samples = new Int16Array(pcm.buffer, pcm.byteOffset, pcm.length / 2);
  const blockSize = 1152;
  const chunks: Buffer[] = [];

  for (let i = 0; i < samples.length; i += blockSize) {
    const slice = samples.subarray(i, i + blockSize);
    const encoded = encoder.encodeBuffer(slice);
    if (encoded.length > 0) chunks.push(Buffer.from(encoded));
  }

  const tail = encoder.flush();
  if (tail.length > 0) chunks.push(Buffer.from(tail));

  return Buffer.concat(chunks);
}

/**
 * Build a multi-speaker transcript with director's notes for Gemini TTS.
 */
function buildTranscript(script: PodcastScript): string {
  const directorNotes = `[Audio Profile: Two Australian professional broadcasters — one female, one male. Strong Australian English accents. Slightly faster than default pace — energetic and sharp, like a morning radio show. Not slow, not robotic.]
[Scene: Morning climate and energy podcast. Two analysts stepping through the day's biggest stories. Brisk, engaged, opinionated.]
[Director's Notes: Speak at a natural-to-brisk pace — about 10% faster than a typical reading speed. ${VOICES.host} (Sarah, female) is direct and incisive, occasionally sceptical. Australian accent. ${VOICES.analyst} (James, male) is data-driven and precise, Australian accent. Both should sound energised and genuinely engaged — not slow or ponderous. Quick transitions between speakers. Emphasis on key numbers and implications.]

`;

  const turns = script.turns
    .map((turn, i) => {
      const voice = turn.speaker === "host" ? VOICES.host : VOICES.analyst;
      // Add pacing variance every few turns
      const wordCount = turn.text.split(/\s+/).length;
      let pacing = "";
      if (wordCount <= 5) {
        // Very short reaction — quick delivery
        pacing = " [quick, no pause before]";
      } else if (i > 0 && i % 5 === 0) {
        // Every 5th turn, slow down slightly for emphasis
        pacing = " [slightly slower, thoughtful]";
      } else if (wordCount > 40) {
        // Longer analytical turns — measured pace with emphasis on key data
        pacing = " [measured pace, emphasise numbers]";
      }
      return `${voice}:${pacing} ${turn.text}`;
    })
    .join("\n\n");

  return directorNotes + turns;
}

