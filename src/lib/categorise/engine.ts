import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_MODEL } from "@/lib/ai-models";
import pool from "@/lib/db";
import { TAXONOMY, VALID_CATEGORY_IDS } from "@/lib/taxonomy";
import type { RawArticle } from "@/lib/types";

const BATCH_SIZE = 20;

interface GeminiResult {
  index: number;
  primary: string;
  secondary: string[];
}

function buildPrompt(articles: RawArticle[]): string {
  const categoryList = TAXONOMY.map(
    (c) => `- ${c.id}: ${c.name} — ${c.description}`
  ).join("\n");

  const articleList = articles
    .map(
      (a, i) =>
        `[${i}] Title: ${a.title}\nSummary: ${a.snippet || "N/A"}\nSource: ${a.source_name}`
    )
    .join("\n\n");

  return `You are a climate and energy news classifier. For each article below, assign:
- primary_category: the single MOST SPECIFIC relevant category ID. Prefer specific categories (solar, wind, storage) over broad ones (policy, science). Only assign "policy" or "science" as primary if the article is fundamentally about policy/regulation or scientific research, not just because it tangentially mentions them.
- secondary_categories: 0-2 additional relevant category IDs (only if genuinely applicable)

Categories:
${categoryList}

Articles to classify:
${articleList}

Respond with JSON only. No explanation. No markdown fences. Format:
[
  {"index": 0, "primary": "solar", "secondary": ["finance", "policy"]},
  {"index": 1, "primary": "transport", "secondary": []}
]`;
}

function parseGeminiResponse(text: string): GeminiResult[] | null {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return null;

    return parsed
      .filter(
        (r: GeminiResult) =>
          typeof r.index === "number" &&
          typeof r.primary === "string" &&
          VALID_CATEGORY_IDS.has(r.primary)
      )
      .map((r: GeminiResult) => ({
        index: r.index,
        primary: r.primary,
        secondary: Array.isArray(r.secondary)
          ? r.secondary.filter((s: string) => VALID_CATEGORY_IDS.has(s) && s !== r.primary)
          : [],
      }));
  } catch {
    return null;
  }
}

/** Result from processing a single batch */
export interface BatchResult {
  articles_processed: number;
  errors: number;
  duration_ms: number;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: number;
  // Progress info
  total_remaining: number;
  total_batches_remaining: number;
  done: boolean;
}

/**
 * Process ONE batch of uncategorised articles (up to 20).
 * Returns progress info so the client can loop.
 */
export async function categoriseOneBatch(): Promise<BatchResult> {
  const start = Date.now();

  if (!process.env.GOOGLE_AI_API_KEY) {
    throw new Error("GOOGLE_AI_API_KEY not set");
  }

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);

  // Fetch uncategorised articles — only grab one batch worth
  const { rows: uncategorised } = await pool.query<RawArticle>(
    `SELECT ra.* FROM raw_articles ra
     LEFT JOIN categorised_articles ca ON ca.raw_article_id = ra.id
     WHERE ca.id IS NULL
     ORDER BY ra.fetched_at DESC
     LIMIT $1`,
    [BATCH_SIZE]
  );

  // Count total remaining (including this batch)
  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*) as count FROM raw_articles ra
     LEFT JOIN categorised_articles ca ON ca.raw_article_id = ra.id
     WHERE ca.id IS NULL`
  );
  const totalRemaining = parseInt(countRows[0].count);

  if (uncategorised.length === 0) {
    return {
      articles_processed: 0,
      errors: 0,
      duration_ms: Date.now() - start,
      input_tokens: 0,
      output_tokens: 0,
      estimated_cost_usd: 0,
      total_remaining: 0,
      total_batches_remaining: 0,
      done: true,
    };
  }

  let processed = 0;
  let errors = 0;
  let inputTokens = 0;
  let outputTokens = 0;

  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
  const prompt = buildPrompt(uncategorised);

  let results: GeminiResult[] | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await model.generateContent(prompt);
      const text = response.response.text();
      const usage = response.response.usageMetadata;
      inputTokens = usage?.promptTokenCount ?? 0;
      outputTokens = usage?.candidatesTokenCount ?? 0;

      results = parseGeminiResponse(text);
      if (results && results.length > 0) break;
    } catch (err) {
      console.error(`Gemini batch attempt ${attempt + 1} failed:`, err);
      if (attempt === 1) {
        errors = uncategorised.length;
      }
    }
  }

  if (results) {
    for (const result of results) {
      const article = uncategorised[result.index];
      if (!article) continue;

      try {
        await pool.query(
          `INSERT INTO categorised_articles (raw_article_id, primary_category, secondary_categories, model_used)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (raw_article_id) DO NOTHING`,
          [article.id, result.primary, result.secondary, GEMINI_MODEL]
        );
        processed++;
      } catch (dbErr) {
        console.error(`DB insert error for article ${article.id}:`, dbErr);
        errors++;
      }
    }
  }

  const estimatedCost =
    (inputTokens * 0.1) / 1_000_000 +
    (outputTokens * 0.4) / 1_000_000;

  const remainingAfter = totalRemaining - processed;

  return {
    articles_processed: processed,
    errors,
    duration_ms: Date.now() - start,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    estimated_cost_usd: estimatedCost,
    total_remaining: remainingAfter,
    total_batches_remaining: Math.ceil(remainingAfter / BATCH_SIZE),
    done: remainingAfter <= 0,
  };
}
