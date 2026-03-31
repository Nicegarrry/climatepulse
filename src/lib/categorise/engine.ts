import { GoogleGenerativeAI } from "@google/generative-ai";
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
  // Strip markdown fences if present
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return null;

    // Validate and sanitise each result
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

async function classifyBatch(
  genAI: GoogleGenerativeAI,
  articles: RawArticle[]
): Promise<{ results: GeminiResult[]; inputTokens: number; outputTokens: number }> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const prompt = buildPrompt(articles);

  let results: GeminiResult[] | null = null;
  let inputTokens = 0;
  let outputTokens = 0;

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
      if (attempt === 1) throw err;
    }
  }

  return { results: results ?? [], inputTokens, outputTokens };
}

export interface CategoriseRunResult {
  articles_processed: number;
  batches_sent: number;
  errors: number;
  duration_ms: number;
  total_input_tokens: number;
  total_output_tokens: number;
  estimated_cost_usd: number;
}

export async function categoriseUncategorised(): Promise<CategoriseRunResult> {
  const start = Date.now();

  if (!process.env.GOOGLE_AI_API_KEY) {
    throw new Error("GOOGLE_AI_API_KEY not set");
  }

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);

  // Fetch uncategorised articles
  const { rows: uncategorised } = await pool.query<RawArticle>(
    `SELECT ra.* FROM raw_articles ra
     LEFT JOIN categorised_articles ca ON ca.raw_article_id = ra.id
     WHERE ca.id IS NULL
     ORDER BY ra.fetched_at DESC`
  );

  if (uncategorised.length === 0) {
    return {
      articles_processed: 0,
      batches_sent: 0,
      errors: 0,
      duration_ms: Date.now() - start,
      total_input_tokens: 0,
      total_output_tokens: 0,
      estimated_cost_usd: 0,
    };
  }

  let totalProcessed = 0;
  let totalErrors = 0;
  let batchesSent = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // Process in batches
  for (let i = 0; i < uncategorised.length; i += BATCH_SIZE) {
    const batch = uncategorised.slice(i, i + BATCH_SIZE);
    batchesSent++;

    try {
      const { results, inputTokens, outputTokens } = await classifyBatch(genAI, batch);
      totalInputTokens += inputTokens;
      totalOutputTokens += outputTokens;

      // Insert results
      for (const result of results) {
        const article = batch[result.index];
        if (!article) continue;

        try {
          await pool.query(
            `INSERT INTO categorised_articles (raw_article_id, primary_category, secondary_categories, model_used)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (raw_article_id) DO NOTHING`,
            [article.id, result.primary, result.secondary, "gemini-2.5-flash"]
          );
          totalProcessed++;
        } catch (dbErr) {
          console.error(`DB insert error for article ${article.id}:`, dbErr);
          totalErrors++;
        }
      }
    } catch (batchErr) {
      console.error(`Batch ${batchesSent} failed entirely:`, batchErr);
      totalErrors += batch.length;
    }
  }

  // Cost: $0.10/1M input, $0.40/1M output
  const estimatedCost =
    (totalInputTokens * 0.1) / 1_000_000 +
    (totalOutputTokens * 0.4) / 1_000_000;

  return {
    articles_processed: totalProcessed,
    batches_sent: batchesSent,
    errors: totalErrors,
    duration_ms: Date.now() - start,
    total_input_tokens: totalInputTokens,
    total_output_tokens: totalOutputTokens,
    estimated_cost_usd: estimatedCost,
  };
}
