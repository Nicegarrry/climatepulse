/**
 * Central AI model configuration + Gemini helpers.
 *
 * Two tiers, one source of truth:
 *   - GEMINI_MODEL       — heavy synthesis (digests, intelligence, podcast,
 *                          weekly, automacc, learn content). Quality-sensitive.
 *   - GEMINI_MODEL_LITE  — simple / high-volume work (ingest classify, enrich,
 *                          categorise, relationship extract, short drafts).
 *                          Cheaper + faster; used as widely as quality allows.
 * Change either here to update every call site at once.
 *
 * THINKING BUDGET (load-bearing): both 3.x Flash models are "thinking" models.
 * With a small `maxOutputTokens`, the thinking tokens (~2.7k observed) consume
 * the budget and the actual JSON answer gets truncated mid-string, which then
 * fails `JSON.parse` and silently falls back to sample/mock content (this is
 * what broke every personalised briefing in 2026-06). `getGeminiModel` disables
 * thinking by default (`thinkingBudget: 0`) so the full output budget goes to
 * the answer. Pass `thinkingBudget` if a specific call genuinely needs it.
 *
 * NOTE: embeddings and TTS deliberately use task-specific models, not these:
 *   - embeddings: `gemini-embedding-001` (src/lib/intelligence/embedder.ts) —
 *     changing it requires re-embedding the whole pgvector corpus.
 *   - TTS: `gemini-2.5-flash-preview-tts` (src/lib/podcast/*) — changing it
 *     changes podcast voices.
 */
import type {
  GoogleGenerativeAI,
  GenerativeModel,
  GenerationConfig,
  Content,
} from "@google/generative-ai";

export const GEMINI_MODEL = "gemini-3.5-flash";
export const GEMINI_MODEL_LITE = "gemini-3.1-flash-lite";

export type GeminiTier = "default" | "lite";

export interface GetGeminiModelOpts {
  /** "default" = heavy GEMINI_MODEL, "lite" = cheap GEMINI_MODEL_LITE. */
  tier?: GeminiTier;
  /** Forwarded to the SDK; responseMimeType/responseSchema/temperature/etc. */
  generationConfig?: Record<string, unknown>;
  /** Forwarded to the SDK as-is. */
  systemInstruction?: string | Content;
  /** Thinking token budget. Defaults to 0 (disabled) to avoid JSON truncation. */
  thinkingBudget?: number;
}

/**
 * Construct a Gemini model with the correct tier and thinking disabled.
 * Drop-in for `genAI.getGenerativeModel({ model: GEMINI_MODEL, ... })`.
 */
export function getGeminiModel(
  genAI: GoogleGenerativeAI,
  opts: GetGeminiModelOpts = {}
): GenerativeModel {
  const {
    tier = "default",
    generationConfig,
    systemInstruction,
    thinkingBudget = 0,
  } = opts;

  return genAI.getGenerativeModel({
    model: tier === "lite" ? GEMINI_MODEL_LITE : GEMINI_MODEL,
    ...(systemInstruction ? { systemInstruction } : {}),
    generationConfig: {
      ...(generationConfig ?? {}),
      thinkingConfig: { thinkingBudget },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any as GenerationConfig,
  });
}

/**
 * Call `model.generateContent` with exponential backoff on Google's transient
 * 429 (rate) / 5xx (incl. 503 "high demand") responses. Google overloads the
 * Flash models in bursts; the previous code retried instantly so both attempts
 * failed together. Non-retryable errors (4xx other than 429) throw immediately.
 */
export async function generateWithRetry(
  model: GenerativeModel,
  request: Parameters<GenerativeModel["generateContent"]>[0],
  opts: { retries?: number; baseDelayMs?: number } = {}
): Promise<Awaited<ReturnType<GenerativeModel["generateContent"]>>> {
  const { retries = 3, baseDelayMs = 700 } = opts;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await model.generateContent(request);
    } catch (err) {
      lastErr = err;
      const status =
        (err as { status?: number })?.status ??
        (typeof (err as { message?: string })?.message === "string" &&
        /\[(\d{3})\s/.test((err as { message: string }).message)
          ? Number(
              (err as { message: string }).message.match(/\[(\d{3})\s/)?.[1]
            )
          : 0);
      const retryable = status === 429 || (status >= 500 && status <= 599);
      if (!retryable || attempt === retries) throw err;
      const jitter = ((attempt + 1) * 173) % 250;
      const delay = baseDelayMs * 2 ** attempt + jitter;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}
