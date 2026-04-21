/**
 * CLI: node --env-file=.env.local --experimental-strip-types scripts/learn/author-concept-card.ts --file <path> [--reviewer <user_id>]
 *
 * Editor-authored concept card insertion. Reads a JSON file matching the
 * ConceptCardLlmOutput schema (see prompts/learn/definitions/concept-card-schema.md).
 * Bypasses the LLM; lands with editorial_status='editor_authored', ai_drafted=false.
 *
 * Idempotency: re-running with the same (slug, disambiguation_context) that
 * already has an editor_authored card will fail on the UNIQUE constraint —
 * use --allow-update to bump the version.
 */
import fs from "node:fs";
import path from "node:path";
import pool from "../../src/lib/db";
import { computeContentHash } from "../../src/lib/learn/concept-cards/generator";
import type {
  ConceptCardLlmOutput,
  SourceCitation,
  KeyMechanism,
} from "../../src/lib/learn/types";

const args = process.argv.slice(2);
const fileIdx = args.indexOf("--file");
const filePath = fileIdx !== -1 ? args[fileIdx + 1] : undefined;

const reviewerIdx = args.indexOf("--reviewer");
const reviewerUserId = reviewerIdx !== -1 ? args[reviewerIdx + 1] : undefined;

const allowUpdate = args.includes("--allow-update");

if (!filePath) {
  console.error(
    "Usage: author-concept-card.ts --file <path-to-json> [--reviewer <user_id>] [--allow-update]",
  );
  process.exit(1);
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

function validate(raw: unknown): {
  ok: true;
  value: ConceptCardLlmOutput;
} | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!raw || typeof raw !== "object") {
    return { ok: false, errors: ["Root must be a JSON object."] };
  }
  const o = raw as Record<string, unknown>;

  for (const f of ["term", "inline_summary", "full_body"] as const) {
    if (typeof o[f] !== "string" || !(o[f] as string).trim()) {
      errors.push(`Missing or empty field: ${f}`);
    }
  }

  if (!Array.isArray(o.source_citations) || o.source_citations.length < 3) {
    errors.push(
      `source_citations must be an array with at least 3 entries (got ${Array.isArray(o.source_citations) ? o.source_citations.length : typeof o.source_citations}).`,
    );
  } else {
    for (const [i, c] of (o.source_citations as unknown[]).entries()) {
      if (
        !c ||
        typeof c !== "object" ||
        typeof (c as Record<string, unknown>).ref !== "string" ||
        typeof (c as Record<string, unknown>).title !== "string"
      ) {
        errors.push(`source_citations[${i}] missing ref/title.`);
      }
    }
  }

  if (typeof o.inline_summary === "string" && countWords(o.inline_summary) > 60) {
    errors.push(
      `inline_summary is ${countWords(o.inline_summary)} words; hard cap is 60.`,
    );
  }

  const VALID_VISUAL = new Set(["none", "chart", "map", "diagram", "photo"]);
  const visual_type = VALID_VISUAL.has(o.visual_type as string)
    ? (o.visual_type as ConceptCardLlmOutput["visual_type"])
    : "none";

  if (errors.length > 0) return { ok: false, errors };

  const citations: SourceCitation[] = (o.source_citations as unknown[]).map((c) => {
    const cc = c as Record<string, unknown>;
    return {
      type: (["url", "document", "internal"].includes(cc.type as string)
        ? cc.type
        : "url") as SourceCitation["type"],
      ref: cc.ref as string,
      title: cc.title as string,
      quote: typeof cc.quote === "string" ? cc.quote : undefined,
      accessed_at:
        typeof cc.accessed_at === "string"
          ? cc.accessed_at
          : new Date().toISOString().split("T")[0],
    };
  });

  const keyMechanisms: KeyMechanism[] = Array.isArray(o.key_mechanisms)
    ? (o.key_mechanisms as unknown[])
        .filter(
          (m): m is Record<string, unknown> =>
            !!m &&
            typeof m === "object" &&
            typeof (m as Record<string, unknown>).title === "string" &&
            typeof (m as Record<string, unknown>).body === "string",
        )
        .map((m) => ({ title: m.title as string, body: m.body as string }))
    : [];

  return {
    ok: true,
    value: {
      term: (o.term as string).trim(),
      abbrev: typeof o.abbrev === "string" ? o.abbrev.trim() || null : null,
      disambiguation_context:
        typeof o.disambiguation_context === "string"
          ? o.disambiguation_context
          : "",
      inline_summary: (o.inline_summary as string).trim(),
      full_body: (o.full_body as string).trim(),
      key_mechanisms: keyMechanisms,
      related_terms: Array.isArray(o.related_terms)
        ? (o.related_terms as unknown[]).filter((t): t is string => typeof t === "string")
        : [],
      visual_type,
      uncertainty_flags: Array.isArray(o.uncertainty_flags)
        ? (o.uncertainty_flags as unknown[]).filter((f): f is string => typeof f === "string")
        : [],
      source_citations: citations,
      primary_domain:
        typeof o.primary_domain === "string" ? o.primary_domain : null,
      microsector_ids: Array.isArray(o.microsector_ids)
        ? (o.microsector_ids as unknown[]).filter((n): n is number => typeof n === "number")
        : [],
      entity_ids: Array.isArray(o.entity_ids)
        ? (o.entity_ids as unknown[]).filter((n): n is number => typeof n === "number")
        : [],
    },
  };
}

(async () => {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    console.error(`[author-concept-card] file not found: ${resolved}`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(resolved, "utf-8"));
  const validated = validate(raw);
  if (!validated.ok) {
    console.error("[author-concept-card] validation failed:");
    for (const e of validated.errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  const card = validated.value;
  const slug = termToSlug(card.term);
  const content_hash = computeContentHash(
    card.term,
    card.abbrev,
    card.inline_summary,
    card.full_body,
    card.key_mechanisms.length > 0 ? card.key_mechanisms : null,
  );

  const existing = await pool.query<{ id: string; version: number }>(
    `SELECT id, version FROM concept_cards
      WHERE slug = $1 AND disambiguation_context = $2`,
    [slug, card.disambiguation_context],
  );

  if (existing.rows.length > 0) {
    if (!allowUpdate) {
      console.error(
        `[author-concept-card] card already exists for slug="${slug}" ctx="${card.disambiguation_context}"; pass --allow-update to bump the version.`,
      );
      process.exit(1);
    }
    const nextVersion = existing.rows[0].version + 1;
    await pool.query(
      `UPDATE concept_cards SET
         term = $2,
         abbrev = $3,
         inline_summary = $4,
         full_body = $5,
         key_mechanisms = $6,
         related_terms = $7,
         visual_type = $8,
         uncertainty_flags = $9,
         source_citations = $10,
         primary_domain = $11,
         microsector_ids = $12,
         entity_ids = $13,
         editorial_status = 'editor_authored',
         reviewed_by = $14,
         reviewed_at = NOW(),
         ai_drafted = FALSE,
         version = $15,
         content_hash = $16,
         updated_at = NOW()
       WHERE id = $1`,
      [
        existing.rows[0].id,
        card.term,
        card.abbrev,
        card.inline_summary,
        card.full_body,
        card.key_mechanisms.length > 0 ? JSON.stringify(card.key_mechanisms) : null,
        card.related_terms,
        card.visual_type,
        JSON.stringify(card.uncertainty_flags),
        JSON.stringify(card.source_citations),
        card.primary_domain,
        card.microsector_ids,
        card.entity_ids,
        reviewerUserId ?? null,
        nextVersion,
        content_hash,
      ],
    );
    console.log(
      `[author-concept-card] updated ${existing.rows[0].id} → v${nextVersion}`,
    );
    process.exit(0);
  }

  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO concept_cards
       (slug, term, abbrev, disambiguation_context, inline_summary, full_body,
        key_mechanisms, related_terms, visual_type, uncertainty_flags,
        source_citations, primary_domain, microsector_ids, entity_ids,
        editorial_status, reviewed_by, reviewed_at, ai_drafted, version, content_hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
             'editor_authored',$15,NOW(),FALSE,1,$16)
     RETURNING id`,
    [
      slug,
      card.term,
      card.abbrev,
      card.disambiguation_context,
      card.inline_summary,
      card.full_body,
      card.key_mechanisms.length > 0 ? JSON.stringify(card.key_mechanisms) : null,
      card.related_terms,
      card.visual_type,
      JSON.stringify(card.uncertainty_flags),
      JSON.stringify(card.source_citations),
      card.primary_domain,
      card.microsector_ids,
      card.entity_ids,
      reviewerUserId ?? null,
      content_hash,
    ],
  );
  console.log(`[author-concept-card] inserted ${rows[0].id} (${card.term})`);
  process.exit(0);
})().catch((err) => {
  console.error("[author-concept-card] fatal:", err);
  process.exit(1);
});
