import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_MODEL } from "@/lib/ai-models";
import pool from "@/lib/db";
import { loadPrompt, assemblePrompt } from "@/lib/enrichment/prompt-loader";

export const PREDICATE_VOCAB = [
  "acquires",
  "partners_with",
  "subsidiary_of",
  "invests_in",
  "develops",
  "operates",
  "funds",
  "regulates",
  "supersedes",
  "located_in",
  "ceo_of",
  "uses_technology",
] as const;

export type Predicate = (typeof PREDICATE_VOCAB)[number] | "_uncategorised";

const VOCAB_SET = new Set<string>(PREDICATE_VOCAB);
const MIN_CONFIDENCE = 0.6;
const MAX_BODY_CHARS = 5000;
const MAX_EVIDENCE_CHARS = 200;

interface RawTriple {
  subject?: unknown;
  predicate?: unknown;
  object?: unknown;
  confidence?: unknown;
  evidence?: unknown;
  raw_predicate?: unknown;
}

interface ValidTriple {
  subjectId: number;
  objectId: number;
  predicate: Predicate;
  confidence: number;
  evidence: string | null;
  rawPredicate: string | null;
}

export interface ExtractInput {
  enrichedArticleId: string;
  title: string;
  body: string;
  /**
   * Map from entity name as it appeared in the Stage 2 result to the resolved
   * `entities.id`. The extractor only emits triples whose subject AND object
   * names are both present in this map.
   */
  nameToIdMap: Map<string, number>;
}

export interface ExtractStats {
  triplesEmittedByModel: number;
  triplesAcceptedAndStored: number;
  triplesRejectedLowConfidence: number;
  triplesRejectedUnresolvedEntity: number;
  triplesRejectedSelfRelation: number;
  triplesUncategorised: number;
  durationMs: number;
}

/**
 * Extract typed entity-to-entity relationships from an article and upsert
 * them into `entity_relationships`. Idempotent — re-running on the same
 * source increments `observation_count` and bumps `last_observed`.
 *
 * Designed to be wrapped in a try/catch by the caller. Any thrown error
 * leaves the existing pgvector + article_entities state untouched.
 */
export async function extractAndStoreRelationships(
  input: ExtractInput
): Promise<ExtractStats> {
  const start = Date.now();

  const stats: ExtractStats = {
    triplesEmittedByModel: 0,
    triplesAcceptedAndStored: 0,
    triplesRejectedLowConfidence: 0,
    triplesRejectedUnresolvedEntity: 0,
    triplesRejectedSelfRelation: 0,
    triplesUncategorised: 0,
    durationMs: 0,
  };

  if (input.nameToIdMap.size < 2) {
    stats.durationMs = Date.now() - start;
    return stats;
  }

  if (!process.env.GOOGLE_AI_API_KEY) {
    throw new Error("GOOGLE_AI_API_KEY not set");
  }

  const entitiesBlock = Array.from(input.nameToIdMap.keys())
    .map((name) => `- ${name}`)
    .join("\n");

  const story = `Title: ${input.title}\n\n${(input.body || "").slice(0, MAX_BODY_CHARS)}`;

  const systemTemplate = loadPrompt("relationship-extraction-system.md");
  const fullPrompt = assemblePrompt(systemTemplate, {
    ENTITIES: entitiesBlock,
    STORY: story,
  });

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  const response = await model.generateContent(fullPrompt);
  const text = response.response.text();

  const rawTriples = parseTriples(text);
  stats.triplesEmittedByModel = rawTriples.length;

  const valid: ValidTriple[] = [];
  for (const t of rawTriples) {
    const validated = validateTriple(t, input.nameToIdMap, stats);
    if (validated) valid.push(validated);
  }

  if (valid.length > 0) {
    await persistTriples(input.enrichedArticleId, valid);
    stats.triplesAcceptedAndStored = valid.length;
  }

  stats.durationMs = Date.now() - start;
  return stats;
}

function parseTriples(text: string): RawTriple[] {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed?.triples)) return parsed.triples;
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

function validateTriple(
  raw: RawTriple,
  nameToIdMap: Map<string, number>,
  stats: ExtractStats
): ValidTriple | null {
  const subjectName = typeof raw.subject === "string" ? raw.subject.trim() : "";
  const objectName = typeof raw.object === "string" ? raw.object.trim() : "";
  const predicateRaw =
    typeof raw.predicate === "string" ? raw.predicate.trim() : "";
  const confidence = typeof raw.confidence === "number" ? raw.confidence : NaN;

  if (!subjectName || !objectName || !predicateRaw || !Number.isFinite(confidence)) {
    return null;
  }

  if (confidence < MIN_CONFIDENCE) {
    stats.triplesRejectedLowConfidence++;
    return null;
  }

  const subjectId = nameToIdMap.get(subjectName);
  const objectId = nameToIdMap.get(objectName);
  if (subjectId == null || objectId == null) {
    stats.triplesRejectedUnresolvedEntity++;
    return null;
  }

  if (subjectId === objectId) {
    stats.triplesRejectedSelfRelation++;
    return null;
  }

  let predicate: Predicate;
  let rawPredicate: string | null = null;

  if (VOCAB_SET.has(predicateRaw)) {
    predicate = predicateRaw as Predicate;
  } else if (predicateRaw === "_uncategorised") {
    const rp = typeof raw.raw_predicate === "string" ? raw.raw_predicate.trim() : "";
    // Rescue case: the model marked the triple _uncategorised but the
    // raw_predicate it supplied is itself a valid vocab entry. The model
    // is being over-cautious — promote it back to the vocab predicate.
    if (rp && VOCAB_SET.has(rp)) {
      predicate = rp as Predicate;
    } else {
      predicate = "_uncategorised";
      rawPredicate = rp || predicateRaw;
      stats.triplesUncategorised++;
    }
  } else {
    predicate = "_uncategorised";
    rawPredicate = predicateRaw;
    stats.triplesUncategorised++;
  }

  const evidenceRaw = typeof raw.evidence === "string" ? raw.evidence.trim() : "";
  const evidence = evidenceRaw ? evidenceRaw.slice(0, MAX_EVIDENCE_CHARS) : null;

  return {
    subjectId,
    objectId,
    predicate,
    confidence: Math.min(1, Math.max(0, confidence)),
    evidence,
    rawPredicate,
  };
}

async function persistTriples(
  enrichedArticleId: string,
  triples: ValidTriple[]
): Promise<void> {
  for (const t of triples) {
    const metadata = t.rawPredicate ? { raw_predicate: t.rawPredicate } : {};
    await pool.query(
      `INSERT INTO entity_relationships (
         subject_id, object_id, predicate, source_type, source_id,
         confidence, evidence, metadata
       ) VALUES ($1, $2, $3, 'article', $4, $5, $6, $7::jsonb)
       ON CONFLICT (subject_id, predicate, object_id, source_type, source_id) DO UPDATE SET
         observation_count = entity_relationships.observation_count + 1,
         last_observed     = NOW(),
         confidence        = GREATEST(entity_relationships.confidence, EXCLUDED.confidence),
         evidence          = COALESCE(EXCLUDED.evidence, entity_relationships.evidence),
         metadata          = entity_relationships.metadata || EXCLUDED.metadata`,
      [
        t.subjectId,
        t.objectId,
        t.predicate,
        enrichedArticleId,
        t.confidence,
        t.evidence,
        JSON.stringify(metadata),
      ]
    );
  }
}
