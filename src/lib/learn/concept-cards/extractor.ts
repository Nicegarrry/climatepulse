import pool from "@/lib/db";
import type {
  ConceptCardCandidate,
  ExtractionSource,
  SourceCitation,
} from "@/lib/learn/types";

export interface ExtractorOpts {
  lookbackDays?: number;
  limit?: number;
}

export interface ExtractorResult {
  inserted: number;
  skipped_dupes: number;
  candidates: Pick<ConceptCardCandidate, "id" | "term" | "extraction_source">[];
}

export interface ManualSeedEntry {
  term: string;
  abbrev?: string;
  disambiguation_context?: string;
  proposed_inline_summary?: string;
  source_refs?: SourceCitation[];
}

export interface CanonicalSource {
  name: string;
  url: string;
  terms: ManualSeedEntry[];
}

async function resolveDedupeGroup(term: string): Promise<string | null> {
  const res = await pool.query<{ id: string; dedupe_group_id: string | null }>(
    `SELECT id, dedupe_group_id FROM concept_card_candidates
      WHERE similarity(lower(term), lower($1)) > 0.7
      ORDER BY similarity(lower(term), lower($1)) DESC LIMIT 1`,
    [term],
  );
  if (res.rows.length === 0) return null;
  return res.rows[0].dedupe_group_id ?? res.rows[0].id;
}

async function insertCandidate(opts: {
  term: string;
  abbrev: string | null;
  disambiguation_context: string;
  proposed_inline_summary: string | null;
  extraction_source: ExtractionSource;
  source_refs: SourceCitation[];
  signal_count: number;
  dedupe_group_id: string | null;
}): Promise<string | null> {
  const existing = await pool.query<{ id: string }>(
    `SELECT id FROM concept_card_candidates
      WHERE lower(term) = lower($1) AND disambiguation_context = $2 LIMIT 1`,
    [opts.term, opts.disambiguation_context],
  );
  if (existing.rows.length > 0) return null;

  const res = await pool.query<{ id: string }>(
    `INSERT INTO concept_card_candidates
       (term, abbrev, disambiguation_context, proposed_inline_summary,
        extraction_source, source_refs, signal_count, dedupe_group_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      opts.term,
      opts.abbrev,
      opts.disambiguation_context,
      opts.proposed_inline_summary,
      opts.extraction_source,
      JSON.stringify(opts.source_refs),
      opts.signal_count,
      opts.dedupe_group_id,
    ],
  );
  return res.rows[0]?.id ?? null;
}

/**
 * Extract candidate terms from recent briefing corpus.
 * Patterns: "Long Form (ABBREV)" / ALLCAPS ≥3 chars / TitleCase multi-word.
 * Only surfaces terms with ≥2 occurrences.
 */
export async function extractFromBriefingCorpus(
  opts: ExtractorOpts = {},
): Promise<ExtractorResult> {
  const lookback = opts.lookbackDays ?? 30;
  const limit = opts.limit ?? 200;

  const rows = await pool.query<{
    title: string;
    snippet: string | null;
    article_url: string;
  }>(
    `SELECT title, snippet, article_url
       FROM raw_articles
       WHERE created_at > NOW() - ($1 || ' days')::INTERVAL
       ORDER BY created_at DESC LIMIT 2000`,
    [lookback],
  );

  const abbrevPattern = /([A-Z][A-Za-z\s-]{3,60})\s+\(([A-Z]{2,8})\)/g;
  const acronymPattern = /\b([A-Z]{3,8})\b/g;
  const multiWordPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b/g;

  const termMap = new Map<
    string,
    { displayTerm: string; abbrev: string | null; count: number; urls: string[] }
  >();

  for (const row of rows.rows) {
    const corpus = `${row.title} ${row.snippet ?? ""}`;

    for (const match of corpus.matchAll(abbrevPattern)) {
      const term = match[1].trim();
      const key = term.toLowerCase();
      const e = termMap.get(key) ?? {
        displayTerm: term,
        abbrev: match[2],
        count: 0,
        urls: [],
      };
      e.count++;
      if (!e.urls.includes(row.article_url)) e.urls.push(row.article_url);
      termMap.set(key, e);
    }
    for (const match of corpus.matchAll(acronymPattern)) {
      const key = match[1].toLowerCase();
      const e = termMap.get(key) ?? {
        displayTerm: match[1],
        abbrev: match[1],
        count: 0,
        urls: [],
      };
      e.count++;
      if (!e.urls.includes(row.article_url)) e.urls.push(row.article_url);
      termMap.set(key, e);
    }
    for (const match of corpus.matchAll(multiWordPattern)) {
      const term = match[1].trim();
      const key = term.toLowerCase();
      const e = termMap.get(key) ?? {
        displayTerm: term,
        abbrev: null,
        count: 0,
        urls: [],
      };
      e.count++;
      if (!e.urls.includes(row.article_url)) e.urls.push(row.article_url);
      termMap.set(key, e);
    }
  }

  const candidates = [...termMap.values()]
    .filter((v) => v.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  let inserted = 0;
  let skipped_dupes = 0;
  const insertedRows: ExtractorResult["candidates"] = [];

  for (const entry of candidates) {
    const dedupeGroup = await resolveDedupeGroup(entry.displayTerm);
    const sourceRefs: SourceCitation[] = entry.urls.slice(0, 5).map((url) => ({
      type: "url" as const,
      ref: url,
      title: url,
      accessed_at: new Date().toISOString().split("T")[0],
    }));
    const id = await insertCandidate({
      term: entry.displayTerm,
      abbrev: entry.abbrev,
      disambiguation_context: "",
      proposed_inline_summary: null,
      extraction_source: "briefing_corpus",
      source_refs: sourceRefs,
      signal_count: entry.count,
      dedupe_group_id: dedupeGroup,
    });
    if (id) {
      inserted++;
      insertedRows.push({
        id,
        term: entry.displayTerm,
        extraction_source: "briefing_corpus",
      });
    } else skipped_dupes++;
  }

  return { inserted, skipped_dupes, candidates: insertedRows };
}

/** Extract regulation + technology entities + top companies by mention_count. */
export async function extractFromEntityRegistry(
  opts: ExtractorOpts = {},
): Promise<ExtractorResult> {
  const limit = opts.limit ?? 100;

  const { rows: regTech } = await pool.query<{
    id: number;
    canonical_name: string;
    entity_type: string;
    mention_count: number;
  }>(
    `SELECT id, canonical_name, entity_type, mention_count FROM entities
      WHERE entity_type IN ('regulation','technology') AND status = 'promoted'
      ORDER BY mention_count DESC LIMIT $1`,
    [Math.floor(limit * 0.8)],
  );
  const { rows: companies } = await pool.query<{
    id: number;
    canonical_name: string;
    entity_type: string;
    mention_count: number;
  }>(
    `SELECT id, canonical_name, entity_type, mention_count FROM entities
      WHERE entity_type = 'company' AND status = 'promoted'
      ORDER BY mention_count DESC LIMIT 20`,
  );

  let inserted = 0;
  let skipped_dupes = 0;
  const insertedRows: ExtractorResult["candidates"] = [];

  for (const entity of [...regTech, ...companies]) {
    const dedupeGroup = await resolveDedupeGroup(entity.canonical_name);
    const id = await insertCandidate({
      term: entity.canonical_name,
      abbrev: null,
      disambiguation_context: "",
      proposed_inline_summary: null,
      extraction_source: "entity_registry",
      source_refs: [
        {
          type: "internal",
          ref: String(entity.id),
          title: `Entity registry: ${entity.canonical_name}`,
          accessed_at: new Date().toISOString().split("T")[0],
        },
      ],
      signal_count: entity.mention_count,
      dedupe_group_id: dedupeGroup,
    });
    if (id) {
      inserted++;
      insertedRows.push({
        id,
        term: entity.canonical_name,
        extraction_source: "entity_registry",
      });
    } else skipped_dupes++;
  }

  return { inserted, skipped_dupes, candidates: insertedRows };
}

/** Editor-provided seed list. */
export async function extractFromManualSeed(
  seedList: ManualSeedEntry[],
): Promise<ExtractorResult> {
  let inserted = 0;
  let skipped_dupes = 0;
  const insertedRows: ExtractorResult["candidates"] = [];
  for (const entry of seedList) {
    const dedupeGroup = await resolveDedupeGroup(entry.term);
    const id = await insertCandidate({
      term: entry.term,
      abbrev: entry.abbrev ?? null,
      disambiguation_context: entry.disambiguation_context ?? "",
      proposed_inline_summary: entry.proposed_inline_summary ?? null,
      extraction_source: "manual_seed",
      source_refs: entry.source_refs ?? [],
      signal_count: 1,
      dedupe_group_id: dedupeGroup,
    });
    if (id) {
      inserted++;
      insertedRows.push({ id, term: entry.term, extraction_source: "manual_seed" });
    } else skipped_dupes++;
  }
  return { inserted, skipped_dupes, candidates: insertedRows };
}

/**
 * Canonical source extraction (stub). URL scraping deferred; forwards a
 * pre-scraped term list through manual_seed then patches extraction_source.
 */
export async function extractFromCanonicalSources(
  sources: CanonicalSource[],
): Promise<ExtractorResult> {
  const allTerms: ManualSeedEntry[] = sources.flatMap((s) =>
    s.terms.map((t) => ({
      ...t,
      source_refs: [
        ...(t.source_refs ?? []),
        {
          type: "url" as const,
          ref: s.url,
          title: s.name,
          accessed_at: new Date().toISOString().split("T")[0],
        },
      ],
    })),
  );
  const result = await extractFromManualSeed(allTerms);
  if (result.candidates.length > 0) {
    await pool.query(
      `UPDATE concept_card_candidates SET extraction_source = 'canonical_source'
        WHERE id = ANY($1::uuid[])`,
      [result.candidates.map((c) => c.id)],
    );
    for (const c of result.candidates) {
      c.extraction_source = "canonical_source";
    }
  }
  return result;
}
