// Newsroom classifier — batched Gemini Flash-lite call.
//
// Differs from Stage 1 enrichment:
//  - Domain only (no signal_type, no entities)
//  - Adds urgency 1-5 and a one-sentence teaser
//  - Headline + snippet only (no full text fetch)
//  - 15 articles per batch (vs Stage 1's 10) since the per-article context
//    is smaller
//
// Gemini's responseSchema enforces JSON shape so we don't have to defend
// against malformed output as aggressively as Stage 1 does.

import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";
import { GEMINI_MODEL } from "@/lib/ai-models";
import { loadPrompt, assemblePrompt } from "@/lib/enrichment/prompt-loader";
import { getDomainSlugs } from "@/lib/enrichment/taxonomy-cache";
import type { ClassifierInput, ClassifierOutput, Urgency } from "./types";

export const NEWSROOM_BATCH_SIZE = 15;
export const NEWSROOM_CONCURRENCY = 3;

// Gemini Flash-lite pricing (per 1M tokens). Mirrors the values used in
// stage1-classifier.ts so the cost model stays consistent.
const INPUT_PRICE_PER_M = 0.15;
const OUTPUT_PRICE_PER_M = 0.6;

interface ClassifyBatchResult {
  results: ClassifierOutput[];
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  durationMs: number;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function buildResponseSchema(domainSlugs: string[]): Schema {
  return {
    type: SchemaType.OBJECT,
    properties: {
      results: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            id: { type: SchemaType.STRING },
            primary_domain: {
              type: SchemaType.STRING,
              format: "enum",
              enum: domainSlugs,
            },
            urgency: { type: SchemaType.INTEGER },
            teaser: { type: SchemaType.STRING },
          },
          required: ["id", "primary_domain", "urgency", "teaser"],
        },
      },
    },
    required: ["results"],
  } as Schema;
}

function clampUrgency(value: unknown): Urgency {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 2;
  if (n < 1) return 1;
  if (n > 5) return 5;
  return n as Urgency;
}

function clampTeaser(value: unknown): string {
  const s = typeof value === "string" ? value.trim() : "";
  if (!s) return "";
  if (s.length <= 160) return s;
  return s.slice(0, 157).replace(/\s\S*$/, "") + "...";
}

async function classifyBatch(
  articles: ClassifierInput[],
  knownDomains: Set<string>
): Promise<ClassifyBatchResult> {
  const start = Date.now();

  if (!process.env.GOOGLE_AI_API_KEY) {
    throw new Error("GOOGLE_AI_API_KEY not set");
  }

  const systemTemplate = loadPrompt("newsroom-classify-system.md");
  const systemPrompt = assemblePrompt(systemTemplate, {
    KNOWN_DOMAINS: Array.from(knownDomains).sort().join(", "),
  });

  const userPrompt = JSON.stringify({ articles });

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: buildResponseSchema(Array.from(knownDomains)),
      temperature: 0.2,
    },
  });

  let inputTokens = 0;
  let outputTokens = 0;
  let parsed: { results?: unknown[] } | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await model.generateContent(
        systemPrompt + "\n\n" + userPrompt
      );
      inputTokens = response.response.usageMetadata?.promptTokenCount ?? 0;
      outputTokens = response.response.usageMetadata?.candidatesTokenCount ?? 0;
      const text = response.response.text();
      parsed = JSON.parse(text);
      if (parsed && Array.isArray(parsed.results)) break;
    } catch (err) {
      console.warn(
        `Newsroom classify attempt ${attempt + 1} failed:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  const idSet = new Set(articles.map((a) => a.id));
  const seen = new Set<string>();
  const results: ClassifierOutput[] = [];

  if (parsed && Array.isArray(parsed.results)) {
    for (const raw of parsed.results) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as Record<string, unknown>;
      const id = typeof r.id === "string" ? r.id : null;
      if (!id || !idSet.has(id) || seen.has(id)) continue;

      const domain = typeof r.primary_domain === "string" ? r.primary_domain : "";
      const validatedDomain = knownDomains.has(domain) ? domain : "policy";
      const teaser = clampTeaser(r.teaser);
      if (!teaser) continue;

      seen.add(id);
      results.push({
        id,
        primary_domain: validatedDomain,
        urgency: clampUrgency(r.urgency),
        teaser,
      });
    }
  }

  const durationMs = Date.now() - start;
  const costUsd =
    (inputTokens * INPUT_PRICE_PER_M) / 1_000_000 +
    (outputTokens * OUTPUT_PRICE_PER_M) / 1_000_000;

  return {
    results,
    inputTokens,
    outputTokens,
    costCents: costUsd * 100,
    durationMs,
  };
}

/**
 * Classify a list of articles, batching at NEWSROOM_BATCH_SIZE and running
 * NEWSROOM_CONCURRENCY batches in parallel. Returns aggregated results and
 * cost telemetry. Articles that the model failed to classify are silently
 * dropped — the next cron tick will pick them up again.
 */
export async function classifyArticles(
  articles: ClassifierInput[]
): Promise<{
  results: ClassifierOutput[];
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  batches: number;
}> {
  if (articles.length === 0) {
    return {
      results: [],
      inputTokens: 0,
      outputTokens: 0,
      costCents: 0,
      batches: 0,
    };
  }

  const knownDomains = await getDomainSlugs();
  const batches = chunk(articles, NEWSROOM_BATCH_SIZE);

  const all: ClassifierOutput[] = [];
  let totalIn = 0;
  let totalOut = 0;
  let totalCost = 0;

  // Fan out NEWSROOM_CONCURRENCY at a time.
  for (let i = 0; i < batches.length; i += NEWSROOM_CONCURRENCY) {
    const slice = batches.slice(i, i + NEWSROOM_CONCURRENCY);
    const settled = await Promise.allSettled(
      slice.map((b) => classifyBatch(b, knownDomains))
    );
    for (const s of settled) {
      if (s.status === "fulfilled") {
        all.push(...s.value.results);
        totalIn += s.value.inputTokens;
        totalOut += s.value.outputTokens;
        totalCost += s.value.costCents;
      } else {
        console.error("Newsroom batch failed:", s.reason);
      }
    }
  }

  return {
    results: all,
    inputTokens: totalIn,
    outputTokens: totalOut,
    costCents: totalCost,
    batches: batches.length,
  };
}
