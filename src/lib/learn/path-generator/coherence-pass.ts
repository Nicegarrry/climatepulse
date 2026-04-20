import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { loadPrompt, assemblePrompt } from "@/lib/enrichment/prompt-loader";
import type {
  PathPlan,
  Intent,
  Revision,
  Warning,
  PathItemType,
} from "./types";

const GEMINI_MODEL = "gemini-2.5-flash";

export interface CoherencePassResult {
  plan: PathPlan;
  revisions: Revision[];
  warnings: Warning[];
  inputTokens: number;
  outputTokens: number;
}

interface CoherenceResponse {
  issues_found: boolean;
  revisions?: Array<{ description: string; items_affected: number }>;
  revised_items?: Array<{
    item_id: string;
    item_type: string;
    item_version?: number;
    chapter: string;
    position: number;
    completion_required: boolean;
    note?: string;
  }>;
  residual_issues?: string[];
}

function summarisePlan(plan: PathPlan): string {
  const lines: string[] = [`Total items: ${plan.items.length}`];
  const byChapter = new Map<string, number>();
  for (const item of plan.items) {
    byChapter.set(item.chapter, (byChapter.get(item.chapter) ?? 0) + 1);
  }
  for (const [c, n] of byChapter) lines.push(`  ${c}: ${n}`);
  lines.push("\nItems (position | type | chapter):");
  for (const item of plan.items.slice(0, 30)) {
    lines.push(`  ${item.position} | ${item.item_type} | ${item.chapter}`);
  }
  if (plan.items.length > 30) lines.push(`  … +${plan.items.length - 30} more`);
  return lines.join("\n");
}

const SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    issues_found: { type: SchemaType.BOOLEAN },
    revisions: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          description: { type: SchemaType.STRING },
          items_affected: { type: SchemaType.NUMBER },
        },
        required: ["description", "items_affected"],
      },
    },
    revised_items: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          item_id: { type: SchemaType.STRING },
          item_type: { type: SchemaType.STRING },
          item_version: { type: SchemaType.NUMBER },
          chapter: { type: SchemaType.STRING },
          position: { type: SchemaType.NUMBER },
          completion_required: { type: SchemaType.BOOLEAN },
          note: { type: SchemaType.STRING },
        },
        required: [
          "item_id",
          "item_type",
          "chapter",
          "position",
          "completion_required",
        ],
      },
    },
    residual_issues: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
  },
  required: ["issues_found"],
};

/**
 * Single LLM coherence review pass. Never re-runs.
 * Returns the original plan if no issues, or a revised plan with revision notes.
 */
export async function coherencePass(
  plan: PathPlan,
  intent: Intent,
): Promise<CoherencePassResult> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    return { plan, revisions: [], warnings: [], inputTokens: 0, outputTokens: 0 };
  }

  const template = await loadPrompt("learn/path-coherence.md");
  const systemInstruction = assemblePrompt(template, {
    PLAN_SUMMARY: summarisePlan(plan),
    INTENT_JSON: JSON.stringify(intent, null, 2),
  });

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: SCHEMA as any,
    } as any,
    systemInstruction,
  });

  const result = await model.generateContent(
    "Review this learning path for coherence.",
  );
  const usage = result.response.usageMetadata;
  const inputTokens = usage?.promptTokenCount ?? 0;
  const outputTokens = usage?.candidatesTokenCount ?? 0;

  let parsed: CoherenceResponse;
  try {
    parsed = JSON.parse(result.response.text()) as CoherenceResponse;
  } catch {
    return {
      plan,
      revisions: [],
      warnings: [
        {
          code: "coherence_parse_error",
          message: "Coherence pass response unparseable; plan shipped as-is.",
        },
      ],
      inputTokens,
      outputTokens,
    };
  }

  if (!parsed.issues_found || !parsed.revised_items) {
    return { plan, revisions: [], warnings: [], inputTokens, outputTokens };
  }

  const revised = parsed.revised_items
    .map((ri, idx) => ({
      item_type: ri.item_type as PathItemType,
      item_id: ri.item_id,
      item_version: ri.item_version,
      chapter: ri.chapter,
      position: ri.position ?? idx,
      completion_required: ri.completion_required ?? true,
      note: ri.note,
    }))
    .sort((a, b) => a.position - b.position);
  revised.forEach((item, idx) => (item.position = idx));

  return {
    plan: { items: revised, chapters: plan.chapters },
    revisions: (parsed.revisions ?? []).map((r) => ({
      description: r.description,
      items_affected: r.items_affected,
    })),
    warnings: (parsed.residual_issues ?? []).map((i) => ({
      code: "residual_coherence_issue",
      message: i,
    })),
    inputTokens,
    outputTokens,
  };
}
