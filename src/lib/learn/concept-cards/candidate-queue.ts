import pool from "@/lib/db";
import type { ConceptCardCandidate, ExtractionSource } from "@/lib/learn/types";
import { generateConceptCard } from "./generator";

export async function listPending(
  limit = 50,
  source?: ExtractionSource,
): Promise<ConceptCardCandidate[]> {
  const params: unknown[] = ["approved", limit];
  const sourceClause = source ? "AND extraction_source = $3" : "";
  if (source) params.push(source);
  const res = await pool.query<ConceptCardCandidate>(
    `SELECT * FROM concept_card_candidates
       WHERE status = $1 ${sourceClause}
       ORDER BY signal_count DESC, created_at ASC LIMIT $2`,
    params,
  );
  return res.rows;
}

export async function approve(
  ids: string[],
  reviewerUserId: string,
): Promise<void> {
  if (ids.length === 0) return;
  await pool.query(
    `UPDATE concept_card_candidates
       SET status = 'approved', reviewed_by = $1, reviewed_at = NOW()
       WHERE id = ANY($2::uuid[]) AND status = 'pending_review'`,
    [reviewerUserId, ids],
  );
}

export async function reject(
  ids: string[],
  reviewerUserId: string,
  reason: string,
): Promise<void> {
  if (ids.length === 0) return;
  await pool.query(
    `UPDATE concept_card_candidates
       SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW(), review_notes = $3
       WHERE id = ANY($2::uuid[]) AND status IN ('pending_review','approved')`,
    [reviewerUserId, ids, reason],
  );
}

export async function promote(candidateId: string): Promise<{ conceptCardId: string }> {
  const cRes = await pool.query<ConceptCardCandidate>(
    `SELECT * FROM concept_card_candidates WHERE id = $1`,
    [candidateId],
  );
  if (cRes.rows.length === 0) {
    throw new CandidateNotFoundError(candidateId);
  }
  const candidate = cRes.rows[0];
  if (candidate.status !== "approved") {
    throw new CandidateNotApprovedError(candidateId, candidate.status);
  }

  const gen = await generateConceptCard(candidate);
  if (gen.refused) throw new GenerationRefusedError(candidateId, gen.refused);
  if (!gen.result) throw new GenerationFailedError(candidateId, gen.parseError ?? "unknown");
  const card = gen.result;

  const cardRes = await pool.query<{ id: string }>(
    `INSERT INTO concept_cards
       (slug, term, abbrev, disambiguation_context, inline_summary, full_body,
        key_mechanisms, related_terms, visual_type, visual_spec, uncertainty_flags,
        source_citations, primary_domain, microsector_ids, entity_ids,
        editorial_status, ai_drafted, version, content_hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'ai_drafted',TRUE,1,$16)
     RETURNING id`,
    [
      card.slug,
      card.term,
      card.abbrev,
      card.disambiguation_context,
      card.inline_summary,
      card.full_body,
      card.key_mechanisms ? JSON.stringify(card.key_mechanisms) : null,
      card.related_terms,
      card.visual_type,
      card.visual_spec ? JSON.stringify(card.visual_spec) : null,
      JSON.stringify(card.uncertainty_flags),
      JSON.stringify(card.source_citations),
      card.primary_domain,
      card.microsector_ids,
      card.entity_ids,
      card.content_hash,
    ],
  );
  const conceptCardId = cardRes.rows[0].id;

  await pool.query(
    `UPDATE concept_card_candidates
       SET status = 'promoted', promoted_to = $1, reviewed_at = NOW()
       WHERE id = $2`,
    [conceptCardId, candidateId],
  );

  if (candidate.dedupe_group_id) {
    await pool.query(
      `UPDATE concept_card_candidates
         SET status = 'rejected',
             review_notes = 'Auto-rejected: sibling in dedupe group promoted',
             reviewed_at = NOW()
         WHERE dedupe_group_id = $1 AND id != $2
           AND status IN ('pending_review','approved')`,
      [candidate.dedupe_group_id, candidateId],
    );
  }

  return { conceptCardId };
}

export class CandidateNotFoundError extends Error {
  constructor(id: string) {
    super(`Candidate not found: ${id}`);
    this.name = "CandidateNotFoundError";
  }
}
export class CandidateNotApprovedError extends Error {
  constructor(id: string, status: string) {
    super(`Candidate ${id} not approved (status: ${status})`);
    this.name = "CandidateNotApprovedError";
  }
}
export class GenerationRefusedError extends Error {
  constructor(id: string, reason: string) {
    super(`Generation refused for ${id}: ${reason}`);
    this.name = "GenerationRefusedError";
  }
}
export class GenerationFailedError extends Error {
  constructor(id: string, detail: string) {
    super(`Generation failed for ${id}: ${detail}`);
    this.name = "GenerationFailedError";
  }
}
