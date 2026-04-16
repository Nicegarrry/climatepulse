/**
 * Text chunking for long-form content embedding.
 *
 * Strategy:
 *   - Short content (≤ TARGET_CHUNK_TOKENS): single chunk, unchunked
 *   - Long content: split at sentence boundaries into overlapping windows
 *
 * Token estimate: 1 token ≈ 4 chars ≈ 0.75 words (conservative for English news prose)
 * gemini-embedding-001 has a 2048 token input limit — we stay well under.
 */

// Target ~500 tokens per chunk (leaves room for metadata prefix + headroom)
const TARGET_CHUNK_TOKENS = 500;
const OVERLAP_TOKENS = 60;
const CHARS_PER_TOKEN = 4;

const TARGET_CHUNK_CHARS = TARGET_CHUNK_TOKENS * CHARS_PER_TOKEN;
const OVERLAP_CHARS = OVERLAP_TOKENS * CHARS_PER_TOKEN;

export interface TextChunk {
  text: string;
  chunk_index: number;
}

/**
 * Split text into sentences using a simple regex.
 * Not perfect (e.g., "Dr. Smith" can split incorrectly) but adequate for news prose.
 */
function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Chunk text into overlapping windows at sentence boundaries.
 *
 * @param text Raw text to chunk
 * @param opts.prefix Optional prefix prepended to every chunk (e.g. "[Article title] ...")
 *                    This helps each chunk carry context when retrieved independently.
 * @returns Array of chunks. Empty input → empty array. Short input → single chunk.
 */
export function chunkText(
  text: string,
  opts: { prefix?: string } = {}
): TextChunk[] {
  if (!text || !text.trim()) return [];

  const prefix = opts.prefix ? `${opts.prefix.trim()}\n\n` : "";
  const effectiveText = text.trim();

  // Short content: single chunk
  if (effectiveText.length + prefix.length <= TARGET_CHUNK_CHARS) {
    return [{ text: `${prefix}${effectiveText}`, chunk_index: 0 }];
  }

  const sentences = splitSentences(effectiveText);
  const chunks: TextChunk[] = [];

  let currentChunk = "";
  let overlapBuffer = ""; // last ~OVERLAP_CHARS of text to prepend to next chunk
  let chunkIndex = 0;

  for (const sentence of sentences) {
    const prospective = currentChunk ? `${currentChunk} ${sentence}` : sentence;

    // If adding this sentence would overflow, flush the current chunk
    if (prospective.length > TARGET_CHUNK_CHARS && currentChunk) {
      chunks.push({
        text: `${prefix}${overlapBuffer}${currentChunk}`.trim(),
        chunk_index: chunkIndex++,
      });

      // Compute overlap for next chunk (tail of current)
      overlapBuffer =
        currentChunk.length > OVERLAP_CHARS
          ? currentChunk.slice(-OVERLAP_CHARS) + " "
          : currentChunk + " ";

      currentChunk = sentence;
    } else {
      currentChunk = prospective;
    }
  }

  // Flush final chunk
  if (currentChunk) {
    chunks.push({
      text: `${prefix}${overlapBuffer}${currentChunk}`.trim(),
      chunk_index: chunkIndex,
    });
  }

  return chunks;
}

/**
 * Estimate token count for a string (rough heuristic).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}
