/**
 * Central AI model configuration.
 *
 * GEMINI_MODEL is the single source of truth for every Gemini text-generation
 * call across the app (enrichment, classification, newsroom, learn, weekly,
 * automacc, share, research "brief" mode, indicators, etc). Change it here to
 * update them all at once.
 *
 * As of 2026-06 this is `gemini-3.5-flash` — the current stable GA Flash model
 * (https://ai.google.dev/gemini-api/docs/models). It replaces the previous
 * `gemini-3.1-flash-lite-preview` and the stray hardcoded `gemini-2.5-flash`
 * values that used to live in src/lib/learn/*.
 *
 * NOTE: embeddings and TTS deliberately use task-specific models, not this one:
 *   - embeddings: `gemini-embedding-001` (src/lib/intelligence/embedder.ts) —
 *     changing it requires re-embedding the whole pgvector corpus.
 *   - TTS: `gemini-2.5-flash-preview-tts` (src/lib/podcast/*) — changing it
 *     changes podcast voices.
 */
export const GEMINI_MODEL = "gemini-3.5-flash";
