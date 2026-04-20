import pool from "@/lib/db";
import { chunkText } from "@/lib/intelligence/chunker";

// ─── Model Configuration ──────────────────────────────────────────────────────

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMENSIONS = 768;
// Free tier: ~100 RPM for gemini-embedding-001. Keep concurrency low to stay under.
const EMBED_CONCURRENCY = 2;
const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 2000;

// ─── Content Types ────────────────────────────────────────────────────────────

export type ContentType =
  | "article"
  | "podcast"
  | "daily_digest"
  | "weekly_digest"
  | "weekly_report"
  | "report_pdf"
  | "youtube_transcript"
  | "learn_content"
  | "concept_card"
  | "microsector_brief"
  | "microsector_brief_block"
  | "learning_path"
  | "deep_dive"
  | "surface_module"
  | "uploaded_doc";

export interface ContentMetadata {
  primary_domain?: string | null;
  microsector_ids?: number[];
  signal_type?: string | null;
  sentiment?: string | null;
  jurisdictions?: string[];
  entity_ids?: number[];
  published_at?: string | Date | null;
  significance_composite?: number | null;
  trustworthiness_tier?: number;
}

// ─── Low-level REST API call ──────────────────────────────────────────────────

function getApiKey(): string {
  const key = process.env.GOOGLE_AI_API_KEY;
  if (!key) throw new Error("GOOGLE_AI_API_KEY not set");
  return key;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function callEmbedContent(text: string, attempt: number = 0): Promise<number[]> {
  const key = getApiKey();
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: { parts: [{ text }] },
        outputDimensionality: EMBEDDING_DIMENSIONS,
      }),
    }
  );

  if (!res.ok) {
    if ((res.status === 429 || res.status === 503) && attempt < MAX_RETRIES) {
      const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt) + Math.random() * 1000;
      await sleep(backoff);
      return callEmbedContent(text, attempt + 1);
    }
    const errText = await res.text();
    throw new Error(`Gemini embed API ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const values = data.embedding?.values;
  if (!Array.isArray(values)) {
    throw new Error(`Unexpected embedding response shape: ${JSON.stringify(data).slice(0, 200)}`);
  }
  return values;
}

async function mapConcurrent<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  limit: number
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (idx < items.length) {
      const current = idx++;
      results[current] = await fn(items[current]);
    }
  });
  await Promise.all(workers);
  return results;
}

// ─── Public API: embed a query ────────────────────────────────────────────────

export async function embedQuery(query: string): Promise<number[]> {
  return callEmbedContent(query);
}

// ─── Low-level: upsert a single content embedding row ─────────────────────────

async function upsertEmbedding(params: {
  content_type: ContentType;
  source_id: string;
  chunk_index: number;
  chunk_text: string;
  embedding: number[];
  metadata: ContentMetadata;
}): Promise<void> {
  const vectorStr = `[${params.embedding.join(",")}]`;
  const m = params.metadata;

  await pool.query(
    `INSERT INTO content_embeddings (
       content_type, source_id, chunk_index, chunk_text, embedding,
       primary_domain, microsector_ids, signal_type, sentiment, jurisdictions,
       entity_ids, published_at, significance_composite, trustworthiness_tier,
       model_used, embedding_dimensions
     ) VALUES (
       $1, $2, $3, $4, $5::vector,
       $6, $7, $8, $9, $10,
       $11, $12, $13, $14,
       $15, $16
     )
     ON CONFLICT (content_type, source_id, chunk_index) DO UPDATE SET
       chunk_text = EXCLUDED.chunk_text,
       embedding = EXCLUDED.embedding,
       primary_domain = EXCLUDED.primary_domain,
       microsector_ids = EXCLUDED.microsector_ids,
       signal_type = EXCLUDED.signal_type,
       sentiment = EXCLUDED.sentiment,
       jurisdictions = EXCLUDED.jurisdictions,
       entity_ids = EXCLUDED.entity_ids,
       published_at = EXCLUDED.published_at,
       significance_composite = EXCLUDED.significance_composite,
       trustworthiness_tier = EXCLUDED.trustworthiness_tier,
       model_used = EXCLUDED.model_used,
       embedding_dimensions = EXCLUDED.embedding_dimensions,
       updated_at = NOW()`,
    [
      params.content_type,
      params.source_id,
      params.chunk_index,
      params.chunk_text,
      vectorStr,
      m.primary_domain ?? null,
      m.microsector_ids ?? [],
      m.signal_type ?? null,
      m.sentiment ?? null,
      m.jurisdictions ?? [],
      m.entity_ids ?? [],
      m.published_at ?? null,
      m.significance_composite ?? null,
      m.trustworthiness_tier ?? 2,
      EMBEDDING_MODEL,
      EMBEDDING_DIMENSIONS,
    ]
  );
}

/**
 * Embed a piece of content (possibly chunked) and store all chunks.
 * Delete any prior chunks for this (content_type, source_id) first.
 */
async function embedAndStoreChunked(params: {
  content_type: ContentType;
  source_id: string;
  text: string;
  prefix?: string;
  metadata: ContentMetadata;
}): Promise<number> {
  const chunks = chunkText(params.text, { prefix: params.prefix });
  if (chunks.length === 0) return 0;

  // Clear any existing chunks for this source to avoid stale data
  await pool.query(
    `DELETE FROM content_embeddings WHERE content_type = $1 AND source_id = $2`,
    [params.content_type, params.source_id]
  );

  // Embed all chunks (concurrency-limited)
  const embeddings = await mapConcurrent(
    chunks,
    (c) => callEmbedContent(c.text),
    EMBED_CONCURRENCY
  );

  // Store
  for (let i = 0; i < chunks.length; i++) {
    await upsertEmbedding({
      content_type: params.content_type,
      source_id: params.source_id,
      chunk_index: chunks[i].chunk_index,
      chunk_text: chunks[i].text,
      embedding: embeddings[i],
      metadata: params.metadata,
    });
  }

  return chunks.length;
}

// ─── Source tier → trustworthiness tier mapping ───────────────────────────────

function mapSourceTierToTrust(sourceTier: number | null | undefined): number {
  if (sourceTier == null) return 2;
  if (sourceTier === 1) return 1;
  if (sourceTier === 2) return 2;
  return 3; // tier 3+ / API / unknown → aggregator
}

// ─── Content-Type Specific Embedders ──────────────────────────────────────────

/**
 * Embed an enriched article. Fetches full text + metadata from the DB.
 */
export async function embedArticle(enrichedArticleId: string): Promise<number> {
  const { rows } = await pool.query<{
    raw_article_id: string;
    title: string;
    snippet: string | null;
    full_text: string | null;
    source_tier: number | null;
    primary_domain: string | null;
    microsector_ids: number[];
    signal_type: string | null;
    sentiment: string | null;
    jurisdictions: string[];
    entity_ids: number[];
    published_at: string | null;
    significance_composite: number | null;
    microsector_names: string[];
    entity_names: string[];
  }>(
    `SELECT
       ra.id AS raw_article_id,
       ra.title,
       ra.snippet,
       ft.content AS full_text,
       s.tier AS source_tier,
       ea.primary_domain,
       ea.microsector_ids,
       ea.signal_type::text,
       ea.sentiment::text,
       ea.jurisdictions,
       ea.significance_composite,
       ra.published_at,
       ARRAY(
         SELECT ae.entity_id FROM article_entities ae WHERE ae.enriched_article_id = ea.id
       ) AS entity_ids,
       ARRAY(
         SELECT tm.name FROM taxonomy_microsectors tm WHERE tm.id = ANY(ea.microsector_ids)
       ) AS microsector_names,
       ARRAY(
         SELECT e.canonical_name FROM entities e
         JOIN article_entities ae ON ae.entity_id = e.id
         WHERE ae.enriched_article_id = ea.id
       ) AS entity_names
     FROM enriched_articles ea
     JOIN raw_articles ra ON ra.id = ea.raw_article_id
     LEFT JOIN full_text_articles ft ON ft.raw_article_id = ra.id
     LEFT JOIN sources s ON s.name = ra.source_name
     WHERE ea.id = $1`,
    [enrichedArticleId]
  );

  if (rows.length === 0) return 0;
  const a = rows[0];

  // Build the main body text
  const body = a.full_text ?? a.snippet ?? "";

  // Metadata prefix helps each chunk carry context (title + taxonomy)
  const metaBits: string[] = [];
  if (a.primary_domain) metaBits.push(`Domain: ${a.primary_domain.replace(/-/g, " ")}`);
  if (a.microsector_names.length) metaBits.push(`Sectors: ${a.microsector_names.join(", ")}`);
  if (a.signal_type) metaBits.push(`Signal: ${a.signal_type.replace(/_/g, " ")}`);
  if (a.entity_names.length) metaBits.push(`Entities: ${a.entity_names.slice(0, 8).join(", ")}`);
  const prefix = `${a.title}\n${metaBits.join(" | ")}`;

  return embedAndStoreChunked({
    content_type: "article",
    source_id: enrichedArticleId,
    text: body || a.title,
    prefix,
    metadata: {
      primary_domain: a.primary_domain,
      microsector_ids: a.microsector_ids ?? [],
      signal_type: a.signal_type,
      sentiment: a.sentiment,
      jurisdictions: a.jurisdictions ?? [],
      entity_ids: a.entity_ids ?? [],
      published_at: a.published_at,
      significance_composite: a.significance_composite,
      trustworthiness_tier: mapSourceTierToTrust(a.source_tier),
    },
  });
}

/**
 * Back-compat alias. Old pipeline code calls embedAndStoreArticle.
 */
export async function embedAndStoreArticle(enrichedArticleId: string): Promise<void> {
  await embedArticle(enrichedArticleId);
}

/**
 * Embed a podcast episode. Flattens the speaker-turn script into a single transcript
 * and chunks it (episodes are typically 1500-3000 words).
 */
export async function embedPodcastEpisode(episodeId: string): Promise<number> {
  const { rows } = await pool.query<{
    id: string;
    briefing_date: string;
    script: { turns?: { speaker: string; text: string }[]; title?: string };
  }>(
    `SELECT id, briefing_date, script FROM podcast_episodes WHERE id = $1`,
    [episodeId]
  );

  if (rows.length === 0) return 0;
  const p = rows[0];
  const turns = p.script?.turns ?? [];
  if (turns.length === 0) return 0;

  const transcript = turns.map((t) => `${t.speaker}: ${t.text}`).join("\n");
  const title = p.script?.title ?? `Podcast — ${p.briefing_date}`;

  return embedAndStoreChunked({
    content_type: "podcast",
    source_id: episodeId,
    text: transcript,
    prefix: `[ClimatePulse Daily podcast transcript] ${title}`,
    metadata: {
      published_at: p.briefing_date,
      trustworthiness_tier: 0, // own editorial output
    },
  });
}

/**
 * Embed a daily digest (per-user briefing). Flattens digest JSON to prose.
 */
export async function embedDailyDigest(briefingId: string): Promise<number> {
  const { rows } = await pool.query<{
    id: string;
    date: string;
    digest: {
      narrative?: string;
      daily_number?: { value?: string; label?: string; context?: string };
      hero_stories?: { headline: string; expert_take?: string; so_what?: string | null }[];
      compact_stories?: { headline: string; one_line_take?: string }[];
    };
  }>(
    `SELECT id, date, digest FROM daily_briefings WHERE id = $1`,
    [briefingId]
  );

  if (rows.length === 0) return 0;
  const b = rows[0];
  const d = b.digest ?? {};

  const parts: string[] = [];
  if (d.narrative) parts.push(`Narrative: ${d.narrative}`);
  if (d.daily_number) {
    parts.push(
      `Daily Number: ${d.daily_number.value ?? ""} ${d.daily_number.label ?? ""} — ${d.daily_number.context ?? ""}`
    );
  }
  for (const hero of d.hero_stories ?? []) {
    parts.push(`Hero story: ${hero.headline}. ${hero.expert_take ?? ""} ${hero.so_what ?? ""}`.trim());
  }
  for (const compact of d.compact_stories ?? []) {
    parts.push(`${compact.headline}. ${compact.one_line_take ?? ""}`.trim());
  }

  const text = parts.join("\n\n");
  if (!text.trim()) return 0;

  return embedAndStoreChunked({
    content_type: "daily_digest",
    source_id: briefingId,
    text,
    prefix: `[ClimatePulse daily briefing — ${b.date}]`,
    metadata: {
      published_at: b.date,
      trustworthiness_tier: 0,
    },
  });
}

/**
 * Embed a weekly editorial digest (human-curated).
 */
export async function embedWeeklyDigest(digestId: string): Promise<number> {
  const { rows } = await pool.query<{
    id: string;
    week_start: string;
    week_end: string;
    headline: string;
    editor_narrative: string;
    curated_stories: { headline: string; editor_take?: string; sector?: string }[];
    theme_commentary: { theme_label: string; commentary: string }[] | null;
    outlook: string | null;
  }>(
    `SELECT id, week_start, week_end, headline, editor_narrative, curated_stories, theme_commentary, outlook
     FROM weekly_digests WHERE id = $1`,
    [digestId]
  );

  if (rows.length === 0) return 0;
  const d = rows[0];

  const parts: string[] = [
    `Headline: ${d.headline}`,
    `Editor narrative: ${d.editor_narrative}`,
  ];

  for (const story of d.curated_stories ?? []) {
    parts.push(
      `Curated: ${story.headline}${story.sector ? ` (${story.sector})` : ""}. ${story.editor_take ?? ""}`.trim()
    );
  }

  for (const theme of d.theme_commentary ?? []) {
    parts.push(`Theme — ${theme.theme_label}: ${theme.commentary}`);
  }

  if (d.outlook) parts.push(`Outlook: ${d.outlook}`);

  const text = parts.join("\n\n");

  return embedAndStoreChunked({
    content_type: "weekly_digest",
    source_id: digestId,
    text,
    prefix: `[The Weekly Pulse — ${d.week_start} to ${d.week_end}]`,
    metadata: {
      published_at: d.week_start,
      trustworthiness_tier: 0,
    },
  });
}

/**
 * Embed a weekly intelligence report (auto-generated theme clusters).
 */
export async function embedWeeklyReport(reportId: string): Promise<number> {
  const { rows } = await pool.query<{
    id: string;
    week_start: string;
    week_end: string;
    theme_clusters: {
      label: string;
      domain: string;
      articles?: { title: string }[];
      key_numbers?: { value: string; unit: string; context: string }[];
    }[];
  }>(
    `SELECT id, week_start, week_end, theme_clusters FROM weekly_reports WHERE id = $1`,
    [reportId]
  );

  if (rows.length === 0) return 0;
  const r = rows[0];

  const parts: string[] = [];
  for (const cluster of r.theme_clusters ?? []) {
    const articleTitles = (cluster.articles ?? []).slice(0, 5).map((a) => a.title).join("; ");
    const numbers = (cluster.key_numbers ?? [])
      .slice(0, 3)
      .map((n) => `${n.value} ${n.unit} — ${n.context}`)
      .join("; ");
    parts.push(
      `Theme: ${cluster.label} (${cluster.domain}). Articles: ${articleTitles}. Key numbers: ${numbers}`.trim()
    );
  }

  const text = parts.join("\n\n");
  if (!text.trim()) return 0;

  return embedAndStoreChunked({
    content_type: "weekly_report",
    source_id: reportId,
    text,
    prefix: `[Weekly intelligence report — ${r.week_start} to ${r.week_end}]`,
    metadata: {
      published_at: r.week_start,
      trustworthiness_tier: 0,
    },
  });
}

// ─── Backfill ────────────────────────────────────────────────────────────────

export interface BackfillStats {
  articles: number;
  podcasts: number;
  daily_digests: number;
  weekly_digests: number;
  weekly_reports: number;
  total_chunks: number;
}

/**
 * Backfill embeddings for all content types that don't have entries in content_embeddings.
 */
export async function backfillEmbeddings(
  onProgress?: (type: ContentType, done: number, total: number) => void
): Promise<BackfillStats> {
  const stats: BackfillStats = {
    articles: 0,
    podcasts: 0,
    daily_digests: 0,
    weekly_digests: 0,
    weekly_reports: 0,
    total_chunks: 0,
  };

  // ── Articles ──
  const { rows: articleRows } = await pool.query<{ id: string }>(
    `SELECT ea.id FROM enriched_articles ea
     WHERE NOT EXISTS (
       SELECT 1 FROM content_embeddings ce
       WHERE ce.content_type = 'article' AND ce.source_id = ea.id::text
     )
     ORDER BY ea.enriched_at DESC`
  );

  for (let i = 0; i < articleRows.length; i++) {
    try {
      const chunks = await embedArticle(articleRows[i].id);
      stats.articles++;
      stats.total_chunks += chunks;
      if (onProgress && i % 10 === 0) {
        onProgress("article", i + 1, articleRows.length);
      }
    } catch (err) {
      console.warn(`Failed to embed article ${articleRows[i].id}:`, err);
    }
  }
  if (onProgress) onProgress("article", articleRows.length, articleRows.length);

  // ── Podcasts ──
  const { rows: podcastRows } = await pool.query<{ id: string }>(
    `SELECT pe.id FROM podcast_episodes pe
     WHERE NOT EXISTS (
       SELECT 1 FROM content_embeddings ce
       WHERE ce.content_type = 'podcast' AND ce.source_id = pe.id
     )`
  );
  for (const p of podcastRows) {
    try {
      const chunks = await embedPodcastEpisode(p.id);
      if (chunks > 0) {
        stats.podcasts++;
        stats.total_chunks += chunks;
      }
    } catch (err) {
      console.warn(`Failed to embed podcast ${p.id}:`, err);
    }
  }
  if (onProgress) onProgress("podcast", podcastRows.length, podcastRows.length);

  // ── Daily digests ──
  const { rows: digestRows } = await pool.query<{ id: string }>(
    `SELECT db.id FROM daily_briefings db
     WHERE NOT EXISTS (
       SELECT 1 FROM content_embeddings ce
       WHERE ce.content_type = 'daily_digest' AND ce.source_id = db.id
     )`
  );
  for (const d of digestRows) {
    try {
      const chunks = await embedDailyDigest(d.id);
      if (chunks > 0) {
        stats.daily_digests++;
        stats.total_chunks += chunks;
      }
    } catch (err) {
      console.warn(`Failed to embed daily digest ${d.id}:`, err);
    }
  }
  if (onProgress) onProgress("daily_digest", digestRows.length, digestRows.length);

  // ── Weekly digests ──
  const { rows: weeklyDigestRows } = await pool.query<{ id: string }>(
    `SELECT wd.id FROM weekly_digests wd
     WHERE NOT EXISTS (
       SELECT 1 FROM content_embeddings ce
       WHERE ce.content_type = 'weekly_digest' AND ce.source_id = wd.id
     )`
  );
  for (const w of weeklyDigestRows) {
    try {
      const chunks = await embedWeeklyDigest(w.id);
      if (chunks > 0) {
        stats.weekly_digests++;
        stats.total_chunks += chunks;
      }
    } catch (err) {
      console.warn(`Failed to embed weekly digest ${w.id}:`, err);
    }
  }
  if (onProgress) onProgress("weekly_digest", weeklyDigestRows.length, weeklyDigestRows.length);

  // ── Weekly reports ──
  const { rows: weeklyReportRows } = await pool.query<{ id: string }>(
    `SELECT wr.id FROM weekly_reports wr
     WHERE NOT EXISTS (
       SELECT 1 FROM content_embeddings ce
       WHERE ce.content_type = 'weekly_report' AND ce.source_id = wr.id
     )`
  );
  for (const r of weeklyReportRows) {
    try {
      const chunks = await embedWeeklyReport(r.id);
      if (chunks > 0) {
        stats.weekly_reports++;
        stats.total_chunks += chunks;
      }
    } catch (err) {
      console.warn(`Failed to embed weekly report ${r.id}:`, err);
    }
  }
  if (onProgress) onProgress("weekly_report", weeklyReportRows.length, weeklyReportRows.length);

  return stats;
}

export { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL };
