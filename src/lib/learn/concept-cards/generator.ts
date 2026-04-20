import crypto from "node:crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { loadPrompt, assemblePrompt } from "@/lib/enrichment/prompt-loader";
import { logGeneration } from "@/lib/learn/cost-tracker";
import type {
  ConceptCard,
  ConceptCardCandidate,
  ConceptCardLlmOutput,
  GenerationResult,
  KeyMechanism,
  SourceCitation,
} from "@/lib/learn/types";

const GEMINI_MODEL = "gemini-2.5-flash";

export function computeContentHash(
  term: string,
  abbrev: string | null,
  inline_summary: string,
  full_body: string,
  key_mechanisms: KeyMechanism[] | null,
): string {
  const payload = [
    term,
    abbrev ?? "",
    inline_summary,
    full_body,
    JSON.stringify(key_mechanisms ?? []),
  ].join("\x00");
  return crypto.createHash("sha256").update(payload, "utf8").digest("hex");
}

function termToSlug(term: string): string {
  return term
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function parseLlmOutput(text: string): {
  parsed: ConceptCardLlmOutput | null;
  error?: string;
} {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  try {
    const raw = JSON.parse(cleaned) as Record<string, unknown>;
    for (const f of ["term", "inline_summary", "full_body"] as const) {
      if (typeof raw[f] !== "string" || !(raw[f] as string).trim()) {
        return { parsed: null, error: `Missing field: ${f}` };
      }
    }
    if (!Array.isArray(raw.source_citations)) {
      return { parsed: null, error: "source_citations not array" };
    }

    const citations: SourceCitation[] = (raw.source_citations as unknown[])
      .filter(
        (c): c is Record<string, unknown> =>
          c !== null &&
          typeof c === "object" &&
          typeof (c as Record<string, unknown>).ref === "string" &&
          typeof (c as Record<string, unknown>).title === "string",
      )
      .map((c) => ({
        type: (["url", "document", "internal"].includes(c.type as string)
          ? c.type
          : "url") as SourceCitation["type"],
        ref: c.ref as string,
        title: c.title as string,
        quote: typeof c.quote === "string" ? c.quote : undefined,
        accessed_at:
          typeof c.accessed_at === "string"
            ? c.accessed_at
            : new Date().toISOString().split("T")[0],
      }));

    const keyMechanisms: KeyMechanism[] = Array.isArray(raw.key_mechanisms)
      ? (raw.key_mechanisms as unknown[])
          .filter(
            (m): m is Record<string, unknown> =>
              m !== null &&
              typeof m === "object" &&
              typeof (m as Record<string, unknown>).title === "string" &&
              typeof (m as Record<string, unknown>).body === "string",
          )
          .map((m) => ({ title: m.title as string, body: m.body as string }))
      : [];

    const VALID_VISUAL = new Set(["none", "chart", "map", "diagram", "photo"]);
    const visual_type = VALID_VISUAL.has(raw.visual_type as string)
      ? (raw.visual_type as ConceptCardLlmOutput["visual_type"])
      : "none";

    return {
      parsed: {
        term: (raw.term as string).trim(),
        abbrev: typeof raw.abbrev === "string" ? raw.abbrev.trim() || null : null,
        disambiguation_context:
          typeof raw.disambiguation_context === "string"
            ? raw.disambiguation_context
            : "",
        inline_summary: (raw.inline_summary as string).trim(),
        full_body: (raw.full_body as string).trim(),
        key_mechanisms: keyMechanisms,
        related_terms: Array.isArray(raw.related_terms)
          ? (raw.related_terms as unknown[]).filter(
              (t): t is string => typeof t === "string",
            )
          : [],
        visual_type,
        uncertainty_flags: Array.isArray(raw.uncertainty_flags)
          ? (raw.uncertainty_flags as unknown[]).filter(
              (f): f is string => typeof f === "string",
            )
          : [],
        source_citations: citations,
        primary_domain:
          typeof raw.primary_domain === "string" ? raw.primary_domain : null,
        microsector_ids: Array.isArray(raw.microsector_ids)
          ? (raw.microsector_ids as unknown[]).filter(
              (n): n is number => typeof n === "number",
            )
          : [],
        entity_ids: Array.isArray(raw.entity_ids)
          ? (raw.entity_ids as unknown[]).filter(
              (n): n is number => typeof n === "number",
            )
          : [],
      },
    };
  } catch (e) {
    return { parsed: null, error: `JSON parse: ${String(e)}` };
  }
}

/**
 * Generate a concept card from an approved candidate. Two-attempt Gemini retry,
 * hard ≥3-source guardrail, SHA-256 content_hash.
 *
 * MODEL SELECTION NOTE: Gemini Flash for drafts; swap to Claude Sonnet for
 * editorially-critical candidates (e.g. canonical_source extraction_source).
 */
export async function generateConceptCard(
  candidate: ConceptCardCandidate,
): Promise<GenerationResult<ConceptCard>> {
  const start = Date.now();
  if (!process.env.GOOGLE_AI_API_KEY) {
    throw new Error("GOOGLE_AI_API_KEY not set");
  }

  const systemTemplate = await loadPrompt("learn/concept-card-generation.md");
  const schemaDefinition = await loadPrompt("learn/definitions/concept-card-schema.md");

  const systemPrompt = assemblePrompt(systemTemplate, {
    CONCEPT_CARD_SCHEMA: schemaDefinition,
    TERM: candidate.term,
    ABBREV: candidate.abbrev ?? "(none)",
    DISAMBIGUATION_CONTEXT:
      candidate.disambiguation_context || "(unambiguous term)",
    PROPOSED_SUMMARY:
      candidate.proposed_inline_summary ?? "(none — generate from scratch)",
    SOURCE_REFS: JSON.stringify(candidate.source_refs ?? [], null, 2),
  });

  const userPrompt = `Generate a concept card for: "${candidate.term}"${candidate.abbrev ? ` (${candidate.abbrev})` : ""}.\n\nReturn ONLY the JSON object.`;

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  let inputTokens = 0;
  let outputTokens = 0;
  let llmOutput: ConceptCardLlmOutput | null = null;
  let parseError: string | undefined;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await model.generateContent(
        systemPrompt + "\n\n" + userPrompt,
      );
      const text = response.response.text();
      const usage = response.response.usageMetadata;
      inputTokens = usage?.promptTokenCount ?? 0;
      outputTokens = usage?.candidatesTokenCount ?? 0;
      const { parsed, error } = parseLlmOutput(text);
      if (parsed) {
        llmOutput = parsed;
        break;
      }
      parseError = error;
    } catch (err) {
      console.error(`[learn/generator] attempt ${attempt + 1} failed:`, err);
    }
  }

  const durationMs = Date.now() - start;
  await logGeneration({
    module: "learn-concept",
    stage: "generate",
    inputTokens,
    outputTokens,
    durationMs,
    itemsProcessed: 1,
    errors: llmOutput ? 0 : 1,
    model: "gemini-flash",
  });

  if (llmOutput && llmOutput.source_citations.length < 3) {
    return {
      result: null,
      inputTokens,
      outputTokens,
      durationMs,
      refused: "insufficient_sources",
    };
  }
  if (!llmOutput) {
    return { result: null, inputTokens, outputTokens, durationMs, parseError };
  }

  if (countWords(llmOutput.inline_summary) > 60) {
    llmOutput.inline_summary =
      llmOutput.inline_summary.split(/\s+/).slice(0, 60).join(" ") + "…";
  }

  const content_hash = computeContentHash(
    llmOutput.term,
    llmOutput.abbrev,
    llmOutput.inline_summary,
    llmOutput.full_body,
    llmOutput.key_mechanisms,
  );

  const card: ConceptCard = {
    id: "",
    slug: termToSlug(llmOutput.term),
    term: llmOutput.term,
    abbrev: llmOutput.abbrev,
    disambiguation_context: llmOutput.disambiguation_context,
    inline_summary: llmOutput.inline_summary,
    full_body: llmOutput.full_body,
    key_mechanisms: llmOutput.key_mechanisms.length > 0 ? llmOutput.key_mechanisms : null,
    related_terms: llmOutput.related_terms,
    visual_type: llmOutput.visual_type,
    visual_spec: null,
    uncertainty_flags: llmOutput.uncertainty_flags,
    source_citations: llmOutput.source_citations,
    primary_domain: llmOutput.primary_domain,
    microsector_ids: llmOutput.microsector_ids,
    entity_ids: llmOutput.entity_ids,
    editorial_status: "ai_drafted",
    reviewed_by: null,
    reviewed_at: null,
    ai_drafted: true,
    version: 1,
    superseded_by: null,
    content_hash,
    created_at: "",
    updated_at: "",
  };

  return { result: card, inputTokens, outputTokens, durationMs };
}
