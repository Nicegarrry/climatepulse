import pool from "@/lib/db";
import { embedQuery } from "@/lib/intelligence/embedder";
import type { ContentType } from "@/lib/intelligence/embedder";
import type { SignalType, Sentiment } from "@/lib/types";

// ─── Query Types ──────────────────────────────────────────────────────────────

export interface RetrievalFilters {
  content_types?: ContentType[];     // default: all
  trustworthiness_tiers?: number[];  // 0=own, 1=primary, 2=secondary, 3=aggregator
  domains?: string[];
  microsector_ids?: number[];
  signal_types?: SignalType[];
  sentiments?: Sentiment[];
  entity_ids?: number[];
  min_significance?: number;
  date_from?: string;
  date_to?: string;
  jurisdictions?: string[];
}

export interface RetrievalOptions {
  limit?: number;
  significanceBoost?: number;  // 0-1 weight of significance in final rank
  recencyBoost?: number;       // 0-1 weight of recency
  trustBoost?: number;         // 0-1 weight of trustworthiness tier (own editorial > source)
  // Deduplicate by source_id (if multiple chunks from same article match, keep best)
  dedupeBySource?: boolean;
}

// ─── Retrieved Content (generic, with display data resolved) ──────────────────

export interface RetrievedContent {
  // Embedding identity
  content_type: ContentType;
  source_id: string;
  chunk_index: number;
  chunk_text: string;

  // Ranking
  similarity: number;        // cosine similarity (0-1)
  combined_score: number;    // blended rank score

  // Metadata
  primary_domain: string | null;
  microsector_ids: number[];
  signal_type: string | null;
  sentiment: string | null;
  jurisdictions: string[];
  entity_ids: number[];
  published_at: string | null;
  significance_composite: number | null;
  trustworthiness_tier: number;

  // Display data resolved via join (varies by content_type)
  title: string;
  subtitle?: string | null;   // source_name for articles, briefing_date for podcasts, etc.
  url?: string | null;
  snippet?: string | null;
}

// ─── Hybrid Retrieval ─────────────────────────────────────────────────────────

export async function retrieveContent(
  query: string,
  filters: RetrievalFilters = {},
  options: RetrievalOptions = {}
): Promise<RetrievedContent[]> {
  const limit = options.limit ?? 20;
  const sigBoost = options.significanceBoost ?? 0.2;
  const recencyBoost = options.recencyBoost ?? 0.1;
  const trustBoost = options.trustBoost ?? 0.1;
  const dedupe = options.dedupeBySource ?? true;

  const queryEmbedding = await embedQuery(query);
  const vectorStr = `[${queryEmbedding.join(",")}]`;

  // Build WHERE clause
  const conditions: string[] = [];
  const params: (string | number | number[] | string[])[] = [vectorStr];
  let p = 2;

  if (filters.content_types?.length) {
    conditions.push(`ce.content_type = ANY($${p})`);
    params.push(filters.content_types);
    p++;
  }

  if (filters.trustworthiness_tiers?.length) {
    conditions.push(`ce.trustworthiness_tier = ANY($${p})`);
    params.push(filters.trustworthiness_tiers);
    p++;
  }

  if (filters.domains?.length) {
    conditions.push(`ce.primary_domain = ANY($${p})`);
    params.push(filters.domains);
    p++;
  }

  if (filters.microsector_ids?.length) {
    conditions.push(`ce.microsector_ids && $${p}`);
    params.push(filters.microsector_ids);
    p++;
  }

  if (filters.signal_types?.length) {
    conditions.push(`ce.signal_type = ANY($${p})`);
    params.push(filters.signal_types);
    p++;
  }

  if (filters.sentiments?.length) {
    conditions.push(`ce.sentiment = ANY($${p})`);
    params.push(filters.sentiments);
    p++;
  }

  if (filters.entity_ids?.length) {
    conditions.push(`ce.entity_ids && $${p}`);
    params.push(filters.entity_ids);
    p++;
  }

  if (filters.min_significance != null) {
    conditions.push(`ce.significance_composite >= $${p}`);
    params.push(filters.min_significance);
    p++;
  }

  if (filters.date_from) {
    conditions.push(`ce.published_at >= $${p}`);
    params.push(filters.date_from);
    p++;
  }

  if (filters.date_to) {
    conditions.push(`ce.published_at <= $${p}`);
    params.push(filters.date_to);
    p++;
  }

  if (filters.jurisdictions?.length) {
    conditions.push(`ce.jurisdictions && $${p}`);
    params.push(filters.jurisdictions);
    p++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Fetch more than needed if deduping
  const fetchLimit = dedupe ? limit * 3 : limit;
  params.push(fetchLimit);
  const limitParam = `$${p}`;

  // Composite score: similarity + significance + recency + trust bonus
  // Recency: linear decay over 180 days (older content gets 0)
  // Trust: own editorial (tier 0) gets maximum bonus, aggregators (tier 3) get minimum
  const sql = `
    WITH ranked AS (
      SELECT
        ce.*,
        1 - (ce.embedding <=> $1::vector) AS similarity,
        GREATEST(0, 1 - EXTRACT(EPOCH FROM (NOW() - COALESCE(ce.published_at, NOW()))) / (86400 * 180)) AS recency,
        (3 - ce.trustworthiness_tier) / 3.0 AS trust_score,
        (1 - (ce.embedding <=> $1::vector)) * ${1 - sigBoost - recencyBoost - trustBoost} +
          COALESCE(ce.significance_composite, 0) / 100.0 * ${sigBoost} +
          GREATEST(0, 1 - EXTRACT(EPOCH FROM (NOW() - COALESCE(ce.published_at, NOW()))) / (86400 * 180)) * ${recencyBoost} +
          (3 - ce.trustworthiness_tier) / 3.0 * ${trustBoost} AS combined_score
      FROM content_embeddings ce
      ${whereClause}
      ORDER BY ce.embedding <=> $1::vector
      LIMIT ${limitParam}
    )
    SELECT * FROM ranked ORDER BY combined_score DESC
  `;

  const { rows: rawRows } = await pool.query(sql, params);

  // Dedupe by (content_type, source_id), keeping the highest-scored chunk per source
  let rows = rawRows;
  if (dedupe) {
    const seen = new Map<string, typeof rawRows[number]>();
    for (const row of rawRows) {
      const key = `${row.content_type}:${row.source_id}`;
      if (!seen.has(key)) seen.set(key, row);
    }
    rows = Array.from(seen.values()).slice(0, limit);
  }

  // Resolve display data for each row based on content_type
  return resolveDisplayData(rows);
}

/**
 * Join back to the appropriate source table to get display data (title, URL, etc.).
 * Batched per content_type for efficiency.
 */
async function resolveDisplayData(rows: Array<Record<string, unknown>>): Promise<RetrievedContent[]> {
  // Group source IDs by content_type
  const bySourceType = new Map<ContentType, string[]>();
  for (const r of rows) {
    const type = r.content_type as ContentType;
    if (!bySourceType.has(type)) bySourceType.set(type, []);
    bySourceType.get(type)!.push(r.source_id as string);
  }

  // Fetch display data per type
  const displayMap = new Map<string, { title: string; subtitle?: string | null; url?: string | null; snippet?: string | null }>();

  // Articles
  const articleIds = bySourceType.get("article");
  if (articleIds?.length) {
    const { rows: aRows } = await pool.query<{
      id: string;
      title: string;
      snippet: string | null;
      source_name: string;
      article_url: string;
    }>(
      `SELECT ea.id, ra.title, ra.snippet, ra.source_name, ra.article_url
       FROM enriched_articles ea
       JOIN raw_articles ra ON ra.id = ea.raw_article_id
       WHERE ea.id = ANY($1::uuid[])`,
      [articleIds]
    );
    for (const a of aRows) {
      displayMap.set(`article:${a.id}`, {
        title: a.title,
        subtitle: a.source_name,
        url: a.article_url,
        snippet: a.snippet,
      });
    }
  }

  // Podcasts
  const podcastIds = bySourceType.get("podcast");
  if (podcastIds?.length) {
    const { rows: pRows } = await pool.query<{
      id: string;
      briefing_date: string;
      audio_url: string;
      script: { title?: string };
    }>(
      `SELECT id, briefing_date, audio_url, script FROM podcast_episodes WHERE id = ANY($1)`,
      [podcastIds]
    );
    for (const p of pRows) {
      displayMap.set(`podcast:${p.id}`, {
        title: p.script?.title ?? `ClimatePulse Daily — ${p.briefing_date}`,
        subtitle: `Podcast — ${p.briefing_date}`,
        url: p.audio_url,
      });
    }
  }

  // Daily digests
  const digestIds = bySourceType.get("daily_digest");
  if (digestIds?.length) {
    const { rows: dRows } = await pool.query<{
      id: string;
      date: string;
      digest: { daily_number?: { label?: string } };
    }>(
      `SELECT id, date, digest FROM daily_briefings WHERE id = ANY($1)`,
      [digestIds]
    );
    for (const d of dRows) {
      displayMap.set(`daily_digest:${d.id}`, {
        title: `Daily Briefing — ${d.date}`,
        subtitle: d.digest?.daily_number?.label ?? null,
      });
    }
  }

  // Weekly digests
  const weeklyDigestIds = bySourceType.get("weekly_digest");
  if (weeklyDigestIds?.length) {
    const { rows: wdRows } = await pool.query<{
      id: string;
      headline: string;
      week_start: string;
      week_end: string;
    }>(
      `SELECT id, headline, week_start, week_end FROM weekly_digests WHERE id = ANY($1)`,
      [weeklyDigestIds]
    );
    for (const w of wdRows) {
      displayMap.set(`weekly_digest:${w.id}`, {
        title: w.headline,
        subtitle: `Weekly Pulse — ${w.week_start} to ${w.week_end}`,
      });
    }
  }

  // Weekly reports
  const weeklyReportIds = bySourceType.get("weekly_report");
  if (weeklyReportIds?.length) {
    const { rows: wrRows } = await pool.query<{
      id: string;
      week_start: string;
      week_end: string;
    }>(
      `SELECT id, week_start, week_end FROM weekly_reports WHERE id = ANY($1)`,
      [weeklyReportIds]
    );
    for (const r of wrRows) {
      displayMap.set(`weekly_report:${r.id}`, {
        title: `Weekly intelligence report — ${r.week_start}`,
        subtitle: `${r.week_start} to ${r.week_end}`,
      });
    }
  }

  // Merge display data into rows
  return rows.map((r) => {
    const key = `${r.content_type}:${r.source_id}`;
    const display = displayMap.get(key) ?? {
      title: `[${r.content_type}] ${r.source_id}`,
    };

    return {
      content_type: r.content_type as ContentType,
      source_id: r.source_id as string,
      chunk_index: r.chunk_index as number,
      chunk_text: r.chunk_text as string,
      similarity: parseFloat(r.similarity as string),
      combined_score: parseFloat(r.combined_score as string),
      primary_domain: (r.primary_domain as string) ?? null,
      microsector_ids: (r.microsector_ids as number[]) ?? [],
      signal_type: (r.signal_type as string) ?? null,
      sentiment: (r.sentiment as string) ?? null,
      jurisdictions: (r.jurisdictions as string[]) ?? [],
      entity_ids: (r.entity_ids as number[]) ?? [],
      published_at:
        r.published_at instanceof Date
          ? r.published_at.toISOString()
          : ((r.published_at as string | null) ?? null),
      significance_composite: r.significance_composite as number | null,
      trustworthiness_tier: r.trustworthiness_tier as number,
      title: display.title,
      subtitle: display.subtitle,
      url: display.url,
      snippet: display.snippet,
    };
  });
}

// ─── Related Content ──────────────────────────────────────────────────────────

/**
 * Find content similar to a given content item using vector similarity.
 */
export async function findRelatedContent(
  contentType: ContentType,
  sourceId: string,
  options: { limit?: number; contentTypes?: ContentType[] } = {}
): Promise<RetrievedContent[]> {
  const limit = options.limit ?? 10;

  // Get the chunk-0 embedding of the source content as reference
  const { rows: refRows } = await pool.query<{ embedding: string }>(
    `SELECT embedding::text AS embedding FROM content_embeddings
     WHERE content_type = $1 AND source_id = $2 AND chunk_index = 0`,
    [contentType, sourceId]
  );
  if (refRows.length === 0) return [];

  const refEmbedding = refRows[0].embedding;

  const typeFilter = options.contentTypes?.length
    ? `AND ce.content_type = ANY($3)`
    : ``;
  const typeParam = options.contentTypes?.length ? options.contentTypes : null;

  const sql = `
    WITH ranked AS (
      SELECT
        ce.*,
        1 - (ce.embedding <=> $1::vector) AS similarity,
        1 - (ce.embedding <=> $1::vector) AS combined_score
      FROM content_embeddings ce
      WHERE NOT (ce.content_type = $2 AND ce.source_id = $4)
        ${typeFilter}
      ORDER BY ce.embedding <=> $1::vector
      LIMIT ${limit * 3}
    )
    SELECT DISTINCT ON (content_type, source_id) *
    FROM ranked
    ORDER BY content_type, source_id, combined_score DESC
    LIMIT ${limit}
  `;

  const params: unknown[] = [refEmbedding, contentType];
  if (typeParam) params.push(typeParam);
  params.push(sourceId);

  const { rows } = await pool.query(sql, params);
  return resolveDisplayData(rows as Array<Record<string, unknown>>);
}

// ─── Entity Intelligence Brief ────────────────────────────────────────────────

export interface EntityBrief {
  entity: {
    id: number;
    canonical_name: string;
    entity_type: string;
    aliases: string[];
    status: string;
    mention_count: number;
    first_seen_at: string;
    last_seen_at: string;
  };
  recent_content: RetrievedContent[];
  domain_distribution: { domain: string; count: number }[];
  signal_distribution: { signal: string; count: number }[];
  significance_trend: { week: string; avg_significance: number }[];
  related_entities: { id: number; name: string; type: string; co_occurrence_count: number }[];
}

export async function getEntityBrief(entityId: number): Promise<EntityBrief | null> {
  const { rows: entityRows } = await pool.query(
    `SELECT * FROM entities WHERE id = $1`,
    [entityId]
  );
  if (entityRows.length === 0) return null;
  const entity = entityRows[0];

  // Recent content mentioning this entity (from content_embeddings)
  const { rows: contentRows } = await pool.query(
    `SELECT DISTINCT ON (content_type, source_id) ce.*,
       1.0 AS similarity,
       COALESCE(ce.significance_composite, 0) / 100.0 AS combined_score
     FROM content_embeddings ce
     WHERE $1 = ANY(ce.entity_ids)
     ORDER BY content_type, source_id, ce.published_at DESC NULLS LAST
     LIMIT 30`,
    [entityId]
  );
  const recentContent = await resolveDisplayData(contentRows as Array<Record<string, unknown>>);

  // Distributions (from article_entities join — source of truth for entity mentions)
  const { rows: domainDist } = await pool.query<{ domain: string; count: number }>(
    `SELECT ea.primary_domain AS domain, COUNT(*)::int AS count
     FROM enriched_articles ea
     JOIN article_entities ae ON ae.enriched_article_id = ea.id
     WHERE ae.entity_id = $1 AND ea.primary_domain IS NOT NULL
     GROUP BY ea.primary_domain
     ORDER BY count DESC`,
    [entityId]
  );

  const { rows: signalDist } = await pool.query<{ signal: string; count: number }>(
    `SELECT ea.signal_type::text AS signal, COUNT(*)::int AS count
     FROM enriched_articles ea
     JOIN article_entities ae ON ae.enriched_article_id = ea.id
     WHERE ae.entity_id = $1 AND ea.signal_type IS NOT NULL
     GROUP BY ea.signal_type
     ORDER BY count DESC`,
    [entityId]
  );

  const { rows: sigTrend } = await pool.query<{ week: string; avg_significance: number }>(
    `SELECT
       DATE_TRUNC('week', ra.published_at)::date::text AS week,
       ROUND(AVG(ea.significance_composite), 1) AS avg_significance
     FROM enriched_articles ea
     JOIN raw_articles ra ON ra.id = ea.raw_article_id
     JOIN article_entities ae ON ae.enriched_article_id = ea.id
     WHERE ae.entity_id = $1
       AND ea.significance_composite IS NOT NULL
       AND ra.published_at IS NOT NULL
     GROUP BY DATE_TRUNC('week', ra.published_at)
     ORDER BY week DESC
     LIMIT 12`,
    [entityId]
  );

  const { rows: relatedEntities } = await pool.query<{
    id: number;
    name: string;
    type: string;
    co_occurrence_count: number;
  }>(
    `SELECT
       e.id, e.canonical_name AS name, e.entity_type AS type,
       COUNT(*)::int AS co_occurrence_count
     FROM article_entities ae1
     JOIN article_entities ae2 ON ae2.enriched_article_id = ae1.enriched_article_id
       AND ae2.entity_id != ae1.entity_id
     JOIN entities e ON e.id = ae2.entity_id
     WHERE ae1.entity_id = $1 AND e.status = 'promoted'
     GROUP BY e.id, e.canonical_name, e.entity_type
     ORDER BY co_occurrence_count DESC
     LIMIT 10`,
    [entityId]
  );

  return {
    entity,
    recent_content: recentContent,
    domain_distribution: domainDist,
    signal_distribution: signalDist,
    significance_trend: sigTrend,
    related_entities: relatedEntities,
  };
}

// ─── Theme Discovery (unchanged — uses enriched_articles directly) ────────────

export interface ThemeCluster {
  domain: string;
  domain_name: string;
  article_count: number;
  avg_significance: number;
  top_entities: { name: string; count: number }[];
  signal_breakdown: Record<string, number>;
  sentiment_breakdown: Record<string, number>;
  sample_articles: {
    id: string;
    title: string;
    significance_composite: number | null;
    source_name: string;
  }[];
}

export async function discoverThemes(
  dateFrom: string,
  dateTo: string,
  minArticles: number = 3
): Promise<ThemeCluster[]> {
  const { rows: domains } = await pool.query<{
    domain: string;
    domain_name: string;
    article_count: number;
    avg_significance: number;
  }>(
    `SELECT
       ea.primary_domain AS domain,
       td.name AS domain_name,
       COUNT(*)::int AS article_count,
       ROUND(AVG(ea.significance_composite), 1) AS avg_significance
     FROM enriched_articles ea
     JOIN raw_articles ra ON ra.id = ea.raw_article_id
     LEFT JOIN taxonomy_domains td ON td.slug = ea.primary_domain
     WHERE ra.published_at >= $1 AND ra.published_at <= $2
       AND ea.primary_domain IS NOT NULL
     GROUP BY ea.primary_domain, td.name
     HAVING COUNT(*) >= $3
     ORDER BY avg_significance DESC NULLS LAST`,
    [dateFrom, dateTo, minArticles]
  );

  const clusters: ThemeCluster[] = [];
  for (const d of domains) {
    const { rows: entities } = await pool.query<{ name: string; count: number }>(
      `SELECT e.canonical_name AS name, COUNT(*)::int AS count
       FROM enriched_articles ea
       JOIN raw_articles ra ON ra.id = ea.raw_article_id
       JOIN article_entities ae ON ae.enriched_article_id = ea.id
       JOIN entities e ON e.id = ae.entity_id
       WHERE ea.primary_domain = $1
         AND ra.published_at >= $2 AND ra.published_at <= $3
         AND e.status = 'promoted'
       GROUP BY e.canonical_name
       ORDER BY count DESC
       LIMIT 5`,
      [d.domain, dateFrom, dateTo]
    );

    const { rows: signals } = await pool.query<{ signal: string; count: number }>(
      `SELECT ea.signal_type::text AS signal, COUNT(*)::int AS count
       FROM enriched_articles ea
       JOIN raw_articles ra ON ra.id = ea.raw_article_id
       WHERE ea.primary_domain = $1
         AND ra.published_at >= $2 AND ra.published_at <= $3
         AND ea.signal_type IS NOT NULL
       GROUP BY ea.signal_type`,
      [d.domain, dateFrom, dateTo]
    );

    const { rows: sentiments } = await pool.query<{ sentiment: string; count: number }>(
      `SELECT ea.sentiment::text AS sentiment, COUNT(*)::int AS count
       FROM enriched_articles ea
       JOIN raw_articles ra ON ra.id = ea.raw_article_id
       WHERE ea.primary_domain = $1
         AND ra.published_at >= $2 AND ra.published_at <= $3
         AND ea.sentiment IS NOT NULL
       GROUP BY ea.sentiment`,
      [d.domain, dateFrom, dateTo]
    );

    const { rows: samples } = await pool.query<{
      id: string;
      title: string;
      significance_composite: number | null;
      source_name: string;
    }>(
      `SELECT ea.id, ra.title, ea.significance_composite, ra.source_name
       FROM enriched_articles ea
       JOIN raw_articles ra ON ra.id = ea.raw_article_id
       WHERE ea.primary_domain = $1
         AND ra.published_at >= $2 AND ra.published_at <= $3
       ORDER BY ea.significance_composite DESC NULLS LAST
       LIMIT 5`,
      [d.domain, dateFrom, dateTo]
    );

    clusters.push({
      domain: d.domain,
      domain_name: d.domain_name,
      article_count: d.article_count,
      avg_significance: d.avg_significance,
      top_entities: entities,
      signal_breakdown: Object.fromEntries(signals.map((s) => [s.signal, s.count])),
      sentiment_breakdown: Object.fromEntries(sentiments.map((s) => [s.sentiment, s.count])),
      sample_articles: samples,
    });
  }

  return clusters;
}
