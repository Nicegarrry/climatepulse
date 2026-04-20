import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import pool from "@/lib/db";
import { loadPrompt, assemblePrompt } from "@/lib/enrichment/prompt-loader";
import type { Intent, LearningLevel, TimeBudget } from "./types";

const GEMINI_MODEL = "gemini-2.5-flash";

const VALID_LEVELS = new Set<LearningLevel>(["intro", "intermediate", "advanced"]);
const VALID_BUDGETS = new Set<TimeBudget>([
  "15m",
  "30m",
  "1h",
  "2h",
  "half_day",
  "full_day",
]);

interface RawIntentResponse {
  in_scope_microsectors: string[];
  learning_level: string;
  orientation: string;
  time_budget: string;
  audience_context: string;
  clarification_needed?: string[];
}

const INTENT_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    in_scope_microsectors: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    learning_level: { type: SchemaType.STRING },
    orientation: { type: SchemaType.STRING },
    time_budget: { type: SchemaType.STRING },
    audience_context: { type: SchemaType.STRING },
    clarification_needed: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
  },
  required: [
    "in_scope_microsectors",
    "learning_level",
    "orientation",
    "time_budget",
    "audience_context",
  ],
};

async function loadMicrosectorIndex() {
  const { rows } = await pool.query<{ id: number; slug: string; name: string }>(
    `SELECT id, slug, name FROM taxonomy_microsectors
       WHERE deprecated_at IS NULL ORDER BY sort_order`,
  );
  return rows;
}

async function resolveSlugsToIds(
  slugs: string[],
): Promise<{ resolved: number[]; unresolved: string[] }> {
  if (slugs.length === 0) return { resolved: [], unresolved: [] };
  const { rows } = await pool.query<{ id: number; slug: string }>(
    `SELECT id, slug FROM taxonomy_microsectors
       WHERE slug = ANY($1::text[]) AND deprecated_at IS NULL`,
    [slugs],
  );
  const found = new Set(rows.map((r) => r.slug));
  return {
    resolved: rows.map((r) => r.id),
    unresolved: slugs.filter((s) => !found.has(s)),
  };
}

/**
 * Parse free-text learning intent into structured Intent.
 * Returns either Intent or {clarification_needed} when ambiguous.
 */
export async function parseIntent(
  freeText: string,
): Promise<Intent | { clarification_needed: string[] }> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY not set");

  const microsectors = await loadMicrosectorIndex();
  const microsectorIndex = microsectors
    .map((m) => `${m.slug} — ${m.name}`)
    .join("\n");

  const template = await loadPrompt("learn/path-intent.md");
  const systemInstruction = assemblePrompt(template, {
    MICROSECTOR_INDEX: microsectorIndex,
  });

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: INTENT_SCHEMA as any,
    } as any,
    systemInstruction,
  });

  const result = await model.generateContent(freeText);
  const raw = result.response.text();
  const parsed = JSON.parse(raw) as RawIntentResponse;

  if (parsed.clarification_needed && parsed.clarification_needed.length > 0) {
    return { clarification_needed: parsed.clarification_needed };
  }

  const { resolved, unresolved } = await resolveSlugsToIds(
    parsed.in_scope_microsectors ?? [],
  );

  if (unresolved.length > 0) {
    return {
      clarification_needed: [
        `These topics weren't found in the taxonomy: ${unresolved.join(", ")}. Try rephrasing.`,
      ],
    };
  }
  if (resolved.length === 0) {
    return {
      clarification_needed: [
        "Couldn't identify a topic area. Could you describe what you want to learn?",
      ],
    };
  }

  return {
    in_scope_microsectors: resolved,
    learning_level: VALID_LEVELS.has(parsed.learning_level as LearningLevel)
      ? (parsed.learning_level as LearningLevel)
      : "intro",
    orientation: parsed.orientation?.trim() ?? "",
    time_budget: VALID_BUDGETS.has(parsed.time_budget as TimeBudget)
      ? (parsed.time_budget as TimeBudget)
      : "30m",
    audience_context: parsed.audience_context?.trim() ?? "",
  };
}
