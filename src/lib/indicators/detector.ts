import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_MODEL } from "@/lib/ai-models";
import pool from "@/lib/db";
import {
  DETECTOR_LIVE_THRESHOLD,
  DETECTOR_QUEUE_THRESHOLD,
} from "@/lib/indicators/types";

// ─── Concurrency helper (mirrors enrichment/pipeline.ts withConcurrency) ────

async function withConcurrency<T>(
  items: T[],
  fn: (item: T) => Promise<void>,
  limit: number
): Promise<void> {
  const queue = [...items];
  const running: Promise<void>[] = [];
  while (queue.length > 0 || running.length > 0) {
    while (running.length < limit && queue.length > 0) {
      const item = queue.shift()!;
      const promise = fn(item).then(() => {
        running.splice(running.indexOf(promise), 1);
      });
      running.push(promise);
    }
    if (running.length > 0) await Promise.race(running);
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface CatalogueRow {
  id: string;
  slug: string;
  name: string;
  sector: string;
  geography: string;
  unit: string;
}

interface ArticleForDetection {
  raw_article_id: string;
  title: string;
  snippet: string | null;
  source_url: string | null;
  full_text: string | null;
  published_at: string | null;
  primary_domain: string;
  secondary_domain: string | null;
}

interface DetectorHit {
  indicator_slug: string;
  value: number | null;
  unit: string | null;
  geography: string | null;
  observed_at: string | null;
  evidence_quote: string;
  confidence: number;
  reason?: string;
}

export interface DetectorBatchResult {
  articles_scanned: number;
  hits_total: number;
  live_updates: number;
  queued_for_review: number;
  dropped: number;
  errors: number;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: number;
}

// ─── Catalogue + article fetch ─────────────────────────────────────────────

async function fetchCatalogue(): Promise<CatalogueRow[]> {
  const { rows } = await pool.query<CatalogueRow>(
    `SELECT id, slug, name, sector, geography, unit
     FROM indicators
     WHERE status = 'live'
     ORDER BY sector, name`
  );
  return rows;
}

// Fetch enriched articles from today's run that haven't been scanned yet.
// Uses a per-run marker on raw_articles is overkill — instead we scope by:
//   - enriched in the last 24h
//   - and not yet present in indicator_values OR indicator_review_queue for any hit
// For step-3 simplicity we just look at the last 24h of enriched_articles.
// Re-running is safe: detection writes only INSERTs, and the unique-ish guard
// is a SELECT-then-skip in detectForArticle when an exact (article, slug) pair
// already exists.
async function fetchArticlesToScan(limit = 200): Promise<ArticleForDetection[]> {
  const { rows } = await pool.query<ArticleForDetection>(
    `SELECT
       ra.id AS raw_article_id,
       ra.title,
       ra.snippet,
       ra.article_url AS source_url,
       ra.published_at,
       ft.content AS full_text,
       ea.primary_domain,
       ea.secondary_domain
     FROM enriched_articles ea
     JOIN raw_articles ra ON ra.id = ea.raw_article_id
     LEFT JOIN full_text_articles ft ON ft.raw_article_id = ra.id
     WHERE ea.enriched_at >= NOW() - INTERVAL '24 hours'
       AND ea.primary_domain IS NOT NULL
       AND ea.primary_domain <> 'uncertain'
     ORDER BY ea.enriched_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

// ─── Prompt + call ─────────────────────────────────────────────────────────

function buildPrompt(article: ArticleForDetection, catalogue: CatalogueRow[]): string {
  const catalogueLines = catalogue
    .map(
      (c) =>
        `- ${c.slug} | ${c.name} | sector=${c.sector} | geography=${c.geography} | unit=${c.unit}`
    )
    .join("\n");

  const body = (article.full_text ?? article.snippet ?? "").slice(0, 5000);

  return `You are a numeric-extraction assistant for a climate/energy intelligence newsroom.

GOAL
Given a news article and a list of tracked quantitative indicators, identify
each indicator the article reports a NEW NUMERIC VALUE for. Only return hits
where the article states or strongly implies a specific numeric value.

INDICATOR CATALOGUE
${catalogueLines}

CONFIDENCE RUBRIC
- 0.95+ : exact match. Indicator slug, unit, and geography all align with the
  article. Article states an explicit number, e.g. "Australian utility-scale
  solar fell to $0.95/W in Q1 2026".
- 0.80–0.94 : match but unit or geography needs interpretation (e.g. article
  reports MW, indicator unit is GW; article reports "Australia" while the
  catalogue says "AU"). Numeric value is explicit.
- 0.60–0.79 : article describes movement qualitatively or implies a value but
  doesn't state it cleanly. Use only if a number is recoverable.
- < 0.60 : do not return.

OUTPUT
Return a single JSON object:
{ "hits": [
  {
    "indicator_slug": "<slug from catalogue>",
    "value": <number, or null if you cannot extract a clean number>,
    "unit": "<unit string from the article, or null>",
    "geography": "<region string, or null>",
    "observed_at": "<ISO date if the article specifies a quarter/month, or null>",
    "evidence_quote": "<the exact sentence(s) from the article that contain the number>",
    "confidence": <0..1>,
    "reason": "<short rationale, optional>"
  }
] }

If the article reports no tracked indicator value, return { "hits": [] }.

ARTICLE
Title: ${article.title}
Source URL: ${article.source_url ?? "(unknown)"}
Published: ${article.published_at ?? "(unknown)"}
Primary domain: ${article.primary_domain}${article.secondary_domain ? `, secondary: ${article.secondary_domain}` : ""}

${body}

Respond with the single JSON object now.`;
}

function parseHits(text: string): DetectorHit[] {
  // Strip markdown fences if present.
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Try to find a JSON object in the text.
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return [];
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return [];
    }
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !Array.isArray((parsed as { hits?: unknown }).hits)
  ) {
    return [];
  }
  const raw = (parsed as { hits: unknown[] }).hits;
  const hits: DetectorHit[] = [];
  for (const h of raw) {
    if (!h || typeof h !== "object") continue;
    const r = h as Record<string, unknown>;
    if (typeof r.indicator_slug !== "string") continue;
    if (typeof r.evidence_quote !== "string" || !r.evidence_quote) continue;
    if (typeof r.confidence !== "number") continue;
    hits.push({
      indicator_slug: r.indicator_slug,
      value: typeof r.value === "number" ? r.value : null,
      unit: typeof r.unit === "string" ? r.unit : null,
      geography: typeof r.geography === "string" ? r.geography : null,
      observed_at: typeof r.observed_at === "string" ? r.observed_at : null,
      evidence_quote: r.evidence_quote,
      confidence: Math.max(0, Math.min(1, r.confidence)),
      reason: typeof r.reason === "string" ? r.reason : undefined,
    });
  }
  return hits;
}

// ─── Routing: live insert vs queue vs drop ─────────────────────────────────

// Small unit-conversion table — enough to handle the common case (MW vs GW etc).
// Anything outside this table that doesn't exactly match the catalogue unit
// gets routed to review with detector_reason capturing the mismatch.
const UNIT_CONVERSIONS: Record<string, Record<string, number>> = {
  MW: { GW: 0.001 },
  GW: { MW: 1000 },
  Wh: { kWh: 0.001 },
  kWh: { Wh: 1000 },
  $: { $: 1 },
};

function tryConvertUnit(
  hitValue: number,
  hitUnit: string,
  targetUnit: string
): number | null {
  if (hitUnit === targetUnit) return hitValue;
  // Strip currency variants ($/W vs $/Wh) — only convert when the slash form
  // matches exactly. We don't try to be clever about $/W → $/kW.
  const conv = UNIT_CONVERSIONS[hitUnit]?.[targetUnit];
  if (typeof conv === "number") return hitValue * conv;
  return null;
}

async function routeHit(
  article: ArticleForDetection,
  hit: DetectorHit,
  cataloguebySlug: Map<string, CatalogueRow>
): Promise<"live" | "queue" | "drop"> {
  // Below queue threshold: drop.
  if (hit.confidence < DETECTOR_QUEUE_THRESHOLD) return "drop";

  const indicator = cataloguebySlug.get(hit.indicator_slug);

  // Unknown slug — propose a novel indicator via review queue.
  if (!indicator) {
    await pool.query(
      `INSERT INTO indicator_review_queue (
         indicator_id, proposed_indicator_slug, proposed_value, proposed_unit,
         proposed_geography, source_article_id, source_url, evidence_quote,
         detector_confidence, detector_reason
       ) VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        hit.indicator_slug,
        hit.value,
        hit.unit,
        hit.geography,
        article.raw_article_id,
        article.source_url,
        hit.evidence_quote,
        hit.confidence,
        hit.reason ?? "Indicator slug not in catalogue",
      ]
    );
    return "queue";
  }

  // Need a numeric value to ever go live.
  if (hit.value === null || !Number.isFinite(hit.value)) {
    await pool.query(
      `INSERT INTO indicator_review_queue (
         indicator_id, proposed_value, proposed_unit, proposed_geography,
         source_article_id, source_url, evidence_quote,
         detector_confidence, detector_reason
       ) VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8)`,
      [
        indicator.id,
        hit.unit,
        hit.geography,
        article.raw_article_id,
        article.source_url,
        hit.evidence_quote,
        hit.confidence,
        hit.reason ?? "No parseable numeric value",
      ]
    );
    return "queue";
  }

  // Try to align unit.
  const convertedValue = hit.unit
    ? tryConvertUnit(hit.value, hit.unit, indicator.unit)
    : hit.value; // No unit returned — assume catalogue unit.

  // Confidence below live threshold OR unit mismatch we can't convert OR
  // geography differs from catalogue → review.
  const geoMatches =
    !hit.geography ||
    hit.geography.toLowerCase() === indicator.geography.toLowerCase() ||
    indicator.geography === "Global";
  const isLiveCandidate =
    hit.confidence >= DETECTOR_LIVE_THRESHOLD &&
    convertedValue !== null &&
    geoMatches;

  if (!isLiveCandidate) {
    const reason: string[] = [];
    if (hit.confidence < DETECTOR_LIVE_THRESHOLD) reason.push("below live threshold");
    if (convertedValue === null) reason.push(`unit ${hit.unit} ↛ ${indicator.unit}`);
    if (!geoMatches) reason.push(`geography ${hit.geography} ≠ ${indicator.geography}`);
    await pool.query(
      `INSERT INTO indicator_review_queue (
         indicator_id, proposed_value, proposed_unit, proposed_geography,
         source_article_id, source_url, evidence_quote,
         detector_confidence, detector_reason
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        indicator.id,
        hit.value,
        hit.unit,
        hit.geography,
        article.raw_article_id,
        article.source_url,
        hit.evidence_quote,
        hit.confidence,
        hit.reason ? `${hit.reason}; ${reason.join(", ")}` : reason.join(", "),
      ]
    );
    return "queue";
  }

  // Live insert. Skip if an identical (article, indicator) pair already exists
  // — happens on re-runs; provenance check + uniqueness here keeps the history
  // clean without needing a unique constraint.
  const dup = await pool.query(
    `SELECT 1 FROM indicator_values
     WHERE indicator_id = $1 AND source_article_id = $2 LIMIT 1`,
    [indicator.id, article.raw_article_id]
  );
  if (dup.rows.length > 0) return "drop";

  const observedAt =
    hit.observed_at ?? article.published_at ?? new Date().toISOString();
  await pool.query(
    `INSERT INTO indicator_values (
       indicator_id, value, unit, geography, observed_at,
       source_type, source_article_id, source_url, evidence_quote, confidence
     ) VALUES ($1, $2, $3, $4, $5, 'article', $6, $7, $8, $9)`,
    [
      indicator.id,
      convertedValue,
      indicator.unit,
      indicator.geography,
      observedAt,
      article.raw_article_id,
      article.source_url,
      hit.evidence_quote,
      hit.confidence,
    ]
  );
  return "live";
}

// ─── Main entry point ──────────────────────────────────────────────────────

export async function runDetectorBatch(): Promise<DetectorBatchResult> {
  const result: DetectorBatchResult = {
    articles_scanned: 0,
    hits_total: 0,
    live_updates: 0,
    queued_for_review: 0,
    dropped: 0,
    errors: 0,
    input_tokens: 0,
    output_tokens: 0,
    estimated_cost_usd: 0,
  };

  if (!process.env.GOOGLE_AI_API_KEY) {
    throw new Error("GOOGLE_AI_API_KEY not set");
  }

  const [catalogue, articles] = await Promise.all([
    fetchCatalogue(),
    fetchArticlesToScan(),
  ]);
  if (catalogue.length === 0) {
    return result;
  }
  result.articles_scanned = articles.length;
  if (articles.length === 0) return result;

  const cataloguebySlug = new Map(catalogue.map((c) => [c.slug, c]));
  const sectorsCovered = new Set(catalogue.map((c) => c.sector));

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  await withConcurrency(
    articles,
    async (article) => {
      // Skip articles whose primary/secondary domain doesn't overlap any
      // catalogue sector — saves a Gemini call.
      const domains = [article.primary_domain, article.secondary_domain].filter(
        (d): d is string => !!d
      );
      if (!domains.some((d) => sectorsCovered.has(d))) return;

      // Filter the catalogue to the article's domains so the prompt is small.
      const slice = catalogue.filter((c) => domains.includes(c.sector));
      if (slice.length === 0) return;

      try {
        const prompt = buildPrompt(article, slice);
        const response = await model.generateContent(prompt);
        const text = response.response.text();
        const usage = response.response.usageMetadata;
        result.input_tokens += usage?.promptTokenCount ?? 0;
        result.output_tokens += usage?.candidatesTokenCount ?? 0;

        const hits = parseHits(text);
        result.hits_total += hits.length;
        for (const hit of hits) {
          try {
            const outcome = await routeHit(article, hit, cataloguebySlug);
            if (outcome === "live") result.live_updates += 1;
            else if (outcome === "queue") result.queued_for_review += 1;
            else result.dropped += 1;
          } catch (err) {
            result.errors += 1;
            console.error(
              "[indicators:detector] route error:",
              err instanceof Error ? err.message : err
            );
          }
        }
      } catch (err) {
        result.errors += 1;
        console.error(
          "[indicators:detector] gemini error:",
          err instanceof Error ? err.message : err
        );
      }
    },
    3
  );

  // Gemini Flash pricing (matches stage2 calc): $0.15/M input, $0.60/M output
  result.estimated_cost_usd =
    Math.round(
      ((result.input_tokens * 0.15) / 1_000_000 +
        (result.output_tokens * 0.6) / 1_000_000) *
        10000
    ) / 10000;

  return result;
}
