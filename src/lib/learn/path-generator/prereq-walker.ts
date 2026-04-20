import pool from "@/lib/db";
import type { ConceptCardRef } from "./types";

export interface WalkOptions {
  maxHops?: number;
  maxPrereqs?: number;
}

export interface WalkResult {
  items: ConceptCardRef[];
  foundationsSummary?: string;
}

/**
 * Walk concept_card_relationships for predicate='prereq' up to maxHops.
 * Returns topologically-ordered prereqs (closest hop first).
 * Tail beyond maxPrereqs compressed into foundationsSummary prose.
 */
export async function walkPrerequisites(
  cardIds: string[],
  opts: WalkOptions = {},
): Promise<WalkResult> {
  const maxHops = opts.maxHops ?? 2;
  const maxPrereqs = opts.maxPrereqs ?? 12;
  if (cardIds.length === 0) return { items: [] };

  const { rows } = await pool.query<{
    id: string;
    term: string;
    version: number;
    hop: number;
  }>(
    `WITH RECURSIVE prereq_walk(card_id, hop) AS (
       SELECT ccr.object_card_id, 1 AS hop
         FROM concept_card_relationships ccr
         WHERE ccr.subject_card_id = ANY($1::uuid[])
           AND ccr.relationship_type = 'prereq'
           AND ccr.confidence >= 0.5
       UNION
       SELECT ccr.object_card_id, pw.hop + 1
         FROM prereq_walk pw
         JOIN concept_card_relationships ccr
           ON ccr.subject_card_id = pw.card_id
         WHERE ccr.relationship_type = 'prereq'
           AND ccr.confidence >= 0.5
           AND pw.hop < $2
     ),
     deduped AS (
       SELECT card_id, MIN(hop) AS hop FROM prereq_walk
         WHERE card_id <> ALL($1::uuid[])
         GROUP BY card_id
     )
     SELECT cc.id, cc.term, cc.version, d.hop
       FROM deduped d JOIN concept_cards cc ON cc.id = d.card_id
       ORDER BY d.hop ASC, cc.term ASC`,
    [cardIds, maxHops],
  );

  const refs: ConceptCardRef[] = rows.map((r) => ({
    id: r.id,
    term: r.term,
    version: r.version,
    hop_distance: r.hop,
  }));

  if (refs.length <= maxPrereqs) return { items: refs };

  const kept = refs.slice(0, maxPrereqs);
  const compressed = refs.slice(maxPrereqs);
  const terms = compressed.map((c) => c.term);
  const listed =
    terms.length <= 3
      ? terms.join(", ")
      : `${terms.slice(0, 3).join(", ")} and ${terms.length - 3} more`;
  const foundationsSummary = `This path also builds on foundational concepts including ${listed}. You may want to review these before starting if you're new to the topic.`;

  return { items: kept, foundationsSummary };
}
