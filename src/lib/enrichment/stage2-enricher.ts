import { GoogleGenerativeAI } from "@google/generative-ai";
import pool from "@/lib/db";
import {
  getTreeForDomains,
  getTaxonomyTree,
  getPromotedEntities,
  getChannelsForDomains,
} from "@/lib/enrichment/taxonomy-cache";
import {
  loadPrompt,
  assemblePrompt,
  extractMicrosectorDefinitions,
  selectCalibrationExamples,
} from "@/lib/enrichment/prompt-loader";
import type {
  RawArticle,
  Stage1Result,
  Stage2Result,
  TaxonomyTreeNode,
  Entity,
  SignificanceScores,
  SignificanceFactorScore,
  QuantitativeData,
  SIGNIFICANCE_WEIGHTS,
} from "@/lib/types";

interface ArticleRow extends RawArticle {
  full_text: string | null;
  full_text_word_count: number | null;
}

const VALID_ENTITY_TYPES = new Set<string>([
  "company",
  "project",
  "regulation",
  "person",
  "technology",
]);

const VALID_ENTITY_ROLES = new Set<string>(["subject", "actor"]);

const VALID_CONFIDENCES = new Set<string>(["high", "medium", "low"]);

const VALID_SENTIMENTS = new Set<string>(["positive", "negative", "neutral", "mixed"]);

/**
 * Build the taxonomy section for Stage 2 from a domain-filtered tree.
 * Same format as the old engine.ts buildTaxonomySection but for filtered tree.
 */
function buildTaxonomySection(tree: TaxonomyTreeNode[]): string {
  const lines: string[] = [];
  for (const node of tree) {
    for (const s of node.sectors) {
      for (const m of s.microsectors) {
        lines.push(
          `[${node.domain.name}] > [${s.sector.name}] > ${m.slug}: ${m.name}${m.description ? " — " + m.description : ""}`
        );
      }
    }
  }
  return lines.join("\n");
}

/**
 * Build the known entities section for prompt context.
 * Reuses the same format as the old engine.ts.
 */
function buildEntitiesSection(entities: Entity[]): string {
  if (entities.length === 0) return "(none yet)";
  return entities
    .slice(0, 100) // Limit to 100 most mentioned
    .map((e) => {
      const aliasStr =
        e.aliases.length > 0 ? ` (aliases: ${e.aliases.join(", ")})` : "";
      return `- ${e.canonical_name} [${e.entity_type}]${aliasStr}`;
    })
    .join("\n");
}

/**
 * Build the transmission channels section for prompt context.
 */
function buildChannelsSection(
  channels: { id: number; label: string; mechanism: string | null; source_domain_name?: string; target_domain_name?: string }[]
): string {
  if (channels.length === 0) return "(none defined for this domain)";
  return channels
    .map((c) => {
      const mech = c.mechanism ? ` Mechanism: ${c.mechanism}` : "";
      return `TC-${c.id}: [${c.source_domain_name || "?"}] → [${c.target_domain_name || "?"}]: ${c.label}.${mech}`;
    })
    .join("\n");
}

/**
 * Enrich a single article with domain-filtered context and significance scoring.
 * This is Stage 2 — runs per-article, not batched.
 */
export async function enrichArticle(
  article: ArticleRow,
  classification: Stage1Result
): Promise<{
  result: Stage2Result;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
}> {
  const start = Date.now();

  if (!process.env.GOOGLE_AI_API_KEY) {
    throw new Error("GOOGLE_AI_API_KEY not set");
  }

  // Determine which domains to load
  const domainSlugs: string[] = [];
  if (classification.primary_domain === "uncertain") {
    // Fallback: load all domains
    const fullTree = await getTaxonomyTree();
    domainSlugs.push(...fullTree.map((n) => n.domain.slug));
  } else {
    domainSlugs.push(classification.primary_domain);
    if (classification.secondary_domain) {
      domainSlugs.push(classification.secondary_domain);
    }
  }

  // Load domain-filtered context in parallel
  const [filteredTree, promotedEntities, channels] = await Promise.all([
    getTreeForDomains(domainSlugs),
    getPromotedEntities(),
    getChannelsForDomains(domainSlugs),
  ]);

  // Build valid slugs set from the filtered tree
  const validSlugs = new Set<string>();
  for (const node of filteredTree) {
    for (const s of node.sectors) {
      for (const m of s.microsectors) {
        validSlugs.add(m.slug);
      }
    }
  }

  // Load and assemble prompt
  const systemTemplate = loadPrompt("stage2-system.md");

  // Get domain-filtered microsector definitions from the definitions file
  const microsectorDefs = extractMicrosectorDefinitions(domainSlugs);

  // Build prompt sections
  const taxonomySection = buildTaxonomySection(filteredTree);
  const entitiesSection = buildEntitiesSection(promotedEntities);
  const channelsSection = buildChannelsSection(channels);
  const calibrationSection = selectCalibrationExamples(
    classification.primary_domain
  );

  // Combine taxonomy tree (slug overview) with detailed definitions
  const fullMicrosectorSection = `TAXONOMY TREE (assign slugs from this list):\n${taxonomySection}\n\nDETAILED DEFINITIONS (use Include/Exclude guidance):\n${microsectorDefs}`;

  const systemPrompt = assemblePrompt(systemTemplate, {
    MICROSECTOR_DEFINITIONS: fullMicrosectorSection,
    ENTITY_REGISTRY: entitiesSection,
    TRANSMISSION_CHANNELS: channelsSection,
    CALIBRATION_EXAMPLES: `SCORING CALIBRATION:\n${calibrationSection}`,
  });

  // Build user prompt with the article
  let articleContent = `Title: ${article.title}\nSource: ${article.source_name}`;
  if (article.published_at) {
    articleContent += `\nPublished: ${article.published_at}`;
  }
  if (article.full_text && classification.context_quality === "full_text") {
    articleContent += `\n\n${article.full_text.slice(0, 5000)}`;
  } else if (article.snippet) {
    articleContent += `\nDescription: ${article.snippet}`;
  }

  const userPrompt = `CONTEXT QUALITY: ${classification.context_quality}\n\nSTORY:\n${articleContent}\n\nRespond with a single JSON object (not an array).`;

  // Call Gemini
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  let inputTokens = 0;
  let outputTokens = 0;
  let parsed: Stage2Result | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await model.generateContent(
        systemPrompt + "\n\n" + userPrompt
      );
      const text = response.response.text();
      const usage = response.response.usageMetadata;
      inputTokens = usage?.promptTokenCount ?? 0;
      outputTokens = usage?.candidatesTokenCount ?? 0;

      parsed = parseStage2Response(
        text,
        validSlugs,
        classification.context_quality
      );
      if (parsed) break;
    } catch (err) {
      console.error(`Stage 2 enrichment attempt ${attempt + 1} failed:`, err);
    }
  }

  if (!parsed) {
    // Return minimal fallback result — headline entities get 'actor' role as safe default
    parsed = {
      microsectors: [],
      entities: classification.headline_entities
        .filter((e) => VALID_ENTITY_TYPES.has(e.likely_type))
        .map((e) => ({
          name: e.name,
          type: e.likely_type,
          role: "actor" as const,
          context: "from headline",
        })),
      jurisdictions: [],
      regulations_referenced: [],
      technologies_referenced: [],
      quantitative_data: null,
      transmission_channels_triggered: [],
      significance: makeDefaultSignificance(),
      sentiment: "neutral",
    };
  }

  const durationMs = Date.now() - start;

  // Log to enrichment_runs
  const estimatedCost =
    (inputTokens * 0.15) / 1_000_000 + (outputTokens * 0.6) / 1_000_000;

  try {
    await pool.query(
      `INSERT INTO enrichment_runs (
        batch_size, articles_processed, errors, duration_ms,
        input_tokens, output_tokens, estimated_cost_usd, stage, pipeline_version
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [1, 1, parsed.microsectors.length === 0 ? 1 : 0, durationMs, inputTokens, outputTokens, estimatedCost, "stage2", 2]
    );
  } catch (logErr) {
    console.error("Failed to log Stage 2 enrichment run:", logErr);
  }

  return { result: parsed, inputTokens, outputTokens, durationMs };
}

/**
 * Parse Stage 2 JSON response with validation and context quality caps.
 */
function parseStage2Response(
  text: string,
  validSlugs: Set<string>,
  contextQuality: string
): Stage2Result | null {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  try {
    const raw = JSON.parse(cleaned);

    // Parse microsectors with validation and context quality caps
    let microsectors: Stage2Result["microsectors"] = [];
    if (Array.isArray(raw.micro_sectors || raw.microsectors)) {
      const rawMs = raw.micro_sectors || raw.microsectors;
      microsectors = rawMs
        .filter(
          (m: { id?: string; slug?: string; confidence?: string }) =>
            validSlugs.has(m.id || m.slug || "")
        )
        .map((m: { id?: string; slug?: string; confidence?: string }) => ({
          slug: m.id || m.slug || "",
          confidence: VALID_CONFIDENCES.has(m.confidence || "")
            ? (m.confidence as "high" | "medium" | "low")
            : "low",
        }));
    }

    // Apply context quality caps
    if (contextQuality === "headline_only") {
      microsectors = microsectors.slice(0, 2);
      microsectors = microsectors.map((m) => ({
        ...m,
        confidence: "low" as const,
      }));
    } else if (contextQuality === "snippet") {
      microsectors = microsectors.slice(0, 2);
      microsectors = microsectors.map((m) => ({
        ...m,
        confidence:
          m.confidence === "high" ? ("medium" as const) : m.confidence,
      }));
    } else {
      microsectors = microsectors.slice(0, 3);
    }

    // Parse entities — require valid role (subject/actor)
    const entities: Stage2Result["entities"] = Array.isArray(raw.entities)
      ? raw.entities
          .filter(
            (e: { name: string; type: string; role?: string; context?: string }) =>
              typeof e.name === "string" &&
              e.name.trim().length > 0 &&
              VALID_ENTITY_TYPES.has(e.type) &&
              VALID_ENTITY_ROLES.has(e.role || "")
          )
          .map((e: { name: string; type: string; role: string; context?: string }) => ({
            name: e.name.trim(),
            type: e.type,
            role: e.role as "subject" | "actor",
            context: typeof e.context === "string" ? e.context : "",
          }))
      : [];

    // Parse jurisdictions
    const jurisdictions: string[] = Array.isArray(raw.jurisdictions)
      ? raw.jurisdictions.filter(
          (j: string) => typeof j === "string" && j.length <= 20
        )
      : [];

    // Parse story-level reference tags
    const regulationsReferenced: string[] = Array.isArray(raw.regulations_referenced)
      ? raw.regulations_referenced.filter(
          (r: string) => typeof r === "string" && r.length > 0
        )
      : [];
    const technologiesReferenced: string[] = Array.isArray(raw.technologies_referenced)
      ? raw.technologies_referenced.filter(
          (t: string) => typeof t === "string" && t.length > 0
        )
      : [];

    // Parse quantitative data — handle both object and string formats
    let quantitativeData: QuantitativeData | null = null;
    if (raw.quantitative_data && typeof raw.quantitative_data === "object") {
      const qd = raw.quantitative_data;
      quantitativeData = {
        primary_metric:
          qd.primary_metric && typeof qd.primary_metric === "object"
            ? {
                value: String(qd.primary_metric.value ?? ""),
                unit: String(qd.primary_metric.unit ?? ""),
                context: String(qd.primary_metric.context ?? ""),
              }
            : typeof qd.primary_metric === "string"
              ? { value: qd.primary_metric, unit: "", context: "" }
              : null,
        delta:
          qd.delta && typeof qd.delta === "object"
            ? {
                value: String(qd.delta.value ?? ""),
                unit: String(qd.delta.unit ?? ""),
                period: String(qd.delta.period ?? ""),
              }
            : null,
      };
    }

    // Parse transmission channels triggered — handle variant key names
    const rawChannels =
      raw.transmission_channels_triggered ??
      raw.transmission_channels ??
      [];
    const channelsTriggered: string[] = Array.isArray(rawChannels)
      ? rawChannels.filter((c: string) => typeof c === "string")
      : [];

    // Parse significance scores — handle variant key names
    // Model may return "significance", "significance_score", or "significance_scores"
    const rawSignificance =
      raw.significance ?? raw.significance_score ?? raw.significance_scores;
    const significance = parseSignificance(rawSignificance);

    // Parse sentiment — default to "neutral" if missing or invalid
    const sentiment = VALID_SENTIMENTS.has(raw.sentiment)
      ? (raw.sentiment as "positive" | "negative" | "neutral" | "mixed")
      : "neutral";

    return {
      microsectors,
      entities,
      jurisdictions,
      regulations_referenced: regulationsReferenced,
      technologies_referenced: technologiesReferenced,
      quantitative_data: quantitativeData,
      transmission_channels_triggered: channelsTriggered,
      significance,
      sentiment,
    };
  } catch {
    return null;
  }
}

/**
 * Parse and validate significance scores from raw JSON.
 * Clamps each factor to 0-10.
 * Handles model variant key names (e.g., "decision_forcing_potential" → "decision_forcing").
 */
function parseSignificance(raw: unknown): SignificanceScores {
  if (!raw || typeof raw !== "object") return makeDefaultSignificance();

  const sig = raw as Record<string, unknown>;

  // Map from our canonical key to possible model variants
  const factorAliases: Record<keyof SignificanceScores, string[]> = {
    impact_breadth: ["impact_breadth", "impact", "breadth"],
    novelty: ["novelty", "novelty_and_surprise", "novelty_surprise"],
    decision_forcing: ["decision_forcing", "decision_forcing_potential", "decision"],
    quantitative_magnitude: ["quantitative_magnitude", "magnitude", "quantitative"],
    source_authority: ["source_authority", "authority", "source"],
    temporal_urgency: ["temporal_urgency", "urgency", "temporal"],
  };

  const result: Record<string, SignificanceFactorScore> = {};

  for (const [factor, aliases] of Object.entries(factorAliases)) {
    // Find the value under any alias
    let val: unknown = undefined;
    for (const alias of aliases) {
      if (sig[alias] !== undefined) {
        val = sig[alias];
        break;
      }
    }

    if (val && typeof val === "object") {
      const v = val as Record<string, unknown>;
      result[factor] = {
        score: Math.max(0, Math.min(10, Number(v.score) || 5)),
        rationale: typeof v.rationale === "string" ? v.rationale : "",
      };
    } else if (typeof val === "number") {
      result[factor] = {
        score: Math.max(0, Math.min(10, val)),
        rationale: "",
      };
    } else {
      result[factor] = { score: 5, rationale: "" };
    }
  }

  return result as unknown as SignificanceScores;
}

/**
 * Create a default neutral significance score.
 */
function makeDefaultSignificance(): SignificanceScores {
  return {
    impact_breadth: { score: 5, rationale: "Default — classification failed" },
    novelty: { score: 5, rationale: "Default — classification failed" },
    decision_forcing: { score: 5, rationale: "Default — classification failed" },
    quantitative_magnitude: { score: 5, rationale: "Default — no data" },
    source_authority: { score: 5, rationale: "Default — classification failed" },
    temporal_urgency: { score: 5, rationale: "Default — classification failed" },
  };
}

/**
 * Compute the weighted composite significance score (0-100).
 */
export function computeComposite(scores: SignificanceScores): number {
  return (
    (scores.impact_breadth.score * 25 +
      scores.novelty.score * 20 +
      scores.decision_forcing.score * 20 +
      scores.quantitative_magnitude.score * 15 +
      scores.source_authority.score * 10 +
      scores.temporal_urgency.score * 10) /
    10
  );
}
