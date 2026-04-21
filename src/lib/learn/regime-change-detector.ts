import pool from "@/lib/db";

// Only predicates currently in the entity_relationships v2 vocab.
// Add 'reforms'/'repeals' here when the CHECK constraint expands.
const REGIME_PREDICATES = ["supersedes", "opposes"] as const;
const MIN_CONFIDENCE = 0.75;
const DEFAULT_LOOKBACK_HOURS = 48;

export interface BriefRegimeFlag {
  briefId: string;
  microsectorId: number;
  relationshipId: string;
  predicate: string;
  subjectId: number;
  objectId: number;
  confidence: number;
  firstObserved: Date;
}

/**
 * Scan entity_relationships for recent high-confidence regime-change triples
 * (supersedes, opposes ≥0.75 confidence) and flag affected microsector_briefs.
 *
 * Does NOT edit content. Only sets regime_change_flagged + appends to
 * regime_change_source_ids + updates regime_change_flagged_at. Idempotent via
 * array_remove + append (same triple won't duplicate).
 *
 * Editorial-queue notify is stubbed as console.log; Phase 3 wires the real API.
 */
export async function detectRegimeChanges(opts: { sinceTimestamp?: Date } = {}) {
  const since =
    opts.sinceTimestamp ??
    new Date(Date.now() - DEFAULT_LOOKBACK_HOURS * 60 * 60 * 1000);

  const { rows: triples } = await pool.query<{
    id: string;
    subject_id: number;
    object_id: number;
    predicate: string;
    confidence: string;
    first_observed: Date;
  }>(
    `SELECT id, subject_id, object_id, predicate, confidence, first_observed
       FROM entity_relationships
       WHERE predicate = ANY($1::text[])
         AND confidence >= $2
         AND first_observed >= $3`,
    [REGIME_PREDICATES as unknown as string[], MIN_CONFIDENCE, since],
  );

  const flagged: BriefRegimeFlag[] = [];
  if (triples.length === 0) return { flagged };

  for (const triple of triples) {
    const { rows: microsectors } = await pool.query<{
      microsector_id: number;
      brief_id: string;
    }>(
      `SELECT DISTINCT ms_id AS microsector_id, mb.id AS brief_id
         FROM (
           SELECT UNNEST(ea.microsector_ids) AS ms_id
             FROM enriched_articles ea
             JOIN article_entities ae ON ae.enriched_article_id = ea.id
            WHERE ae.entity_id = ANY($1::int[])
         ) sub
         JOIN microsector_briefs mb ON mb.microsector_id = sub.ms_id`,
      [[triple.subject_id, triple.object_id]],
    );

    for (const ms of microsectors) {
      // Idempotent append: remove-then-append avoids duplicates.
      await pool.query(
        `UPDATE microsector_briefs
            SET regime_change_flagged    = TRUE,
                regime_change_source_ids =
                  array_remove(regime_change_source_ids, $2) || ARRAY[$2]::text[],
                regime_change_flagged_at = NOW(),
                updated_at               = NOW()
          WHERE id = $1`,
        [ms.brief_id, triple.id],
      );

      flagged.push({
        briefId: ms.brief_id,
        microsectorId: ms.microsector_id,
        relationshipId: triple.id,
        predicate: triple.predicate,
        subjectId: triple.subject_id,
        objectId: triple.object_id,
        confidence: parseFloat(triple.confidence),
        firstObserved: triple.first_observed,
      });

      // TODO(Phase 3): enqueueEditorialReview({ kind: 'regime_change', briefId, triple })
      console.log(
        `[regime-change-detector] flagged brief=${ms.brief_id} ms=${ms.microsector_id} via triple=${triple.id}`,
      );
    }
  }

  return { flagged };
}
