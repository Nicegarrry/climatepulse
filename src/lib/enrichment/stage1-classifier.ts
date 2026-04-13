import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_MODEL } from "@/lib/ai-models";
import pool from "@/lib/db";
import { getDomainSlugs } from "@/lib/enrichment/taxonomy-cache";
import { loadPrompt, assemblePrompt } from "@/lib/enrichment/prompt-loader";
import type {
  RawArticle,
  Stage1Result,
  SignalType,
  ContextQuality,
} from "@/lib/types";

interface ArticleRow extends RawArticle {
  full_text: string | null;
  full_text_word_count: number | null;
}

const VALID_SIGNAL_TYPES = new Set<string>([
  "market_move",
  "policy_change",
  "project_milestone",
  "corporate_action",
  "enforcement",
  "personnel",
  "technology_advance",
  "international",
  "community_social",
]);

const VALID_ENTITY_TYPES = new Set<string>([
  "company",
  "project",
  "regulation",
  "person",
  "technology",
]);

interface GeminiStage1Response {
  id: string;
  primary_domain: string;
  secondary_domain: string | null;
  signal_type: string;
  headline_entities: { name: string; likely_type: string }[];
}

/**
 * Determine context quality based on available text fields.
 * This is app-level logic, NOT determined by the AI.
 */
export function determineContextQuality(article: ArticleRow): ContextQuality {
  if (article.full_text && (article.full_text_word_count ?? 0) >= 100) {
    return "full_text";
  }
  if (article.snippet && article.snippet.trim().length > 0) {
    return "snippet";
  }
  return "headline_only";
}

/**
 * Classify a batch of up to 10 articles into domains and signal types.
 * This is the cheap, fast Stage 1 — uses minimal context per article.
 */
export async function classifyBatch(
  articles: ArticleRow[]
): Promise<{ results: Stage1Result[]; inputTokens: number; outputTokens: number; durationMs: number }> {
  const start = Date.now();

  if (!process.env.GOOGLE_AI_API_KEY) {
    throw new Error("GOOGLE_AI_API_KEY not set");
  }

  const knownDomains = await getDomainSlugs();

  // Load and assemble prompt
  const systemTemplate = loadPrompt("stage1-system.md");
  const domainDefs = loadPrompt("definitions/domains.md");
  const signalDefs = loadPrompt("definitions/signal-types.md");

  const systemPrompt = assemblePrompt(systemTemplate, {
    DOMAIN_DEFINITIONS: domainDefs,
    SIGNAL_TYPES: signalDefs,
  });

  // Build article list for user prompt
  const storiesJson = articles.map((a) => ({
    id: a.id,
    title: a.title,
    description: a.snippet || "",
    source: a.source_name,
  }));

  const userPrompt = `Classify each of the following stories. Return a JSON array with one object per story, in the same order.\n\n${JSON.stringify(storiesJson, null, 2)}`;

  // Call Gemini
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  let parsed: GeminiStage1Response[] | null = null;
  let inputTokens = 0;
  let outputTokens = 0;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await model.generateContent(
        systemPrompt + "\n\n" + userPrompt
      );
      const text = response.response.text();
      const usage = response.response.usageMetadata;
      inputTokens = usage?.promptTokenCount ?? 0;
      outputTokens = usage?.candidatesTokenCount ?? 0;

      parsed = parseStage1Response(text);
      if (parsed && parsed.length > 0) break;
    } catch (err) {
      console.error(`Stage 1 classification attempt ${attempt + 1} failed:`, err);
    }
  }

  if (!parsed) {
    // If classification fails entirely, return "uncertain" for all articles
    const fallbackResults: Stage1Result[] = articles.map((a) => ({
      raw_article_id: a.id,
      primary_domain: "uncertain",
      secondary_domain: null,
      signal_type: "corporate_action" as SignalType,
      headline_entities: [],
      context_quality: determineContextQuality(a),
    }));
    return {
      results: fallbackResults,
      inputTokens,
      outputTokens,
      durationMs: Date.now() - start,
    };
  }

  // Map Gemini responses back to articles and validate
  const articleMap = new Map(articles.map((a) => [a.id, a]));
  const results: Stage1Result[] = [];

  for (const resp of parsed) {
    const article = articleMap.get(resp.id);
    if (!article) continue;

    // Validate domain slug
    let primaryDomain = resp.primary_domain;
    if (primaryDomain !== "uncertain" && !knownDomains.has(primaryDomain)) {
      primaryDomain = "uncertain";
    }

    let secondaryDomain = resp.secondary_domain;
    if (secondaryDomain && !knownDomains.has(secondaryDomain)) {
      secondaryDomain = null;
    }

    // Validate signal type
    const signalType = VALID_SIGNAL_TYPES.has(resp.signal_type)
      ? (resp.signal_type as SignalType)
      : ("corporate_action" as SignalType);

    // Validate headline entities
    const entities = Array.isArray(resp.headline_entities)
      ? resp.headline_entities.filter(
          (e) =>
            typeof e.name === "string" &&
            e.name.trim().length > 0 &&
            VALID_ENTITY_TYPES.has(e.likely_type)
        )
      : [];

    results.push({
      raw_article_id: article.id,
      primary_domain: primaryDomain,
      secondary_domain: secondaryDomain,
      signal_type: signalType,
      headline_entities: entities,
      context_quality: determineContextQuality(article),
    });
  }

  // For any articles that weren't in the response, add fallbacks
  for (const article of articles) {
    if (!results.find((r) => r.raw_article_id === article.id)) {
      results.push({
        raw_article_id: article.id,
        primary_domain: "uncertain",
        secondary_domain: null,
        signal_type: "corporate_action" as SignalType,
        headline_entities: [],
        context_quality: determineContextQuality(article),
      });
    }
  }

  // Log to enrichment_runs
  const durationMs = Date.now() - start;
  const estimatedCost =
    (inputTokens * 0.15) / 1_000_000 + (outputTokens * 0.6) / 1_000_000;

  try {
    await pool.query(
      `INSERT INTO enrichment_runs (
        batch_size, articles_processed, errors, duration_ms,
        input_tokens, output_tokens, estimated_cost_usd, stage, pipeline_version
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [articles.length, results.length, 0, durationMs, inputTokens, outputTokens, estimatedCost, "stage1", 2]
    );
  } catch (logErr) {
    console.error("Failed to log Stage 1 enrichment run:", logErr);
  }

  return { results, inputTokens, outputTokens, durationMs };
}

/**
 * Parse the Stage 1 JSON response from Gemini.
 */
function parseStage1Response(text: string): GeminiStage1Response[] | null {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(
      (r: GeminiStage1Response) =>
        typeof r.id === "string" && typeof r.primary_domain === "string"
    );
  } catch {
    return null;
  }
}
