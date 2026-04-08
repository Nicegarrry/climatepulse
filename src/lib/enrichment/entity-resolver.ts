import pool from "@/lib/db";
import type { EntityType, EntityRole } from "@/lib/types";

const VALID_ENTITY_TYPES = new Set<string>([
  "company",
  "project",
  "regulation",
  "person",
  "technology",
]);

/**
 * Strips common corporate/legal suffixes and normalises for matching.
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(
      /\b(the|ltd|pty|inc|corp|corporation|limited|group|plc|co|s\.?a\.?|n\.?v\.?|gmbh|ag)\b/gi,
      ""
    )
    .replace(/[.,()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Resolve entity mentions from AI output to entity IDs.
 * Uses a cascade: exact match -> alias match -> normalised match -> create new.
 * No fuzzy matching — missed merges are preferable to false merges at this scale.
 */
export async function resolveEntities(
  mentions: { name: string; type: string; role: EntityRole }[]
): Promise<{ entityId: number; role: EntityRole; created: boolean }[]> {
  const results: { entityId: number; role: EntityRole; created: boolean }[] = [];

  for (const mention of mentions) {
    // Normalize name
    const name = mention.name.trim().replace(/\s+/g, " ");
    if (!name) continue;

    // Validate entity type
    if (!VALID_ENTITY_TYPES.has(mention.type)) continue;
    const entityType = mention.type as EntityType;

    let entityId: number | null = null;
    let created = false;

    // 1. Exact match on canonical_name
    const { rows: exactRows } = await pool.query<{ id: number }>(
      `SELECT id FROM entities WHERE canonical_name = $1 AND entity_type = $2`,
      [name, entityType]
    );
    if (exactRows.length > 0) {
      entityId = exactRows[0].id;
    }

    // 2. Alias match
    if (entityId == null) {
      const { rows: aliasRows } = await pool.query<{ id: number }>(
        `SELECT id FROM entities WHERE $1 = ANY(aliases) AND entity_type = $2`,
        [name, entityType]
      );
      if (aliasRows.length > 0) {
        entityId = aliasRows[0].id;
      }
    }

    // 3. Normalised match — strip suffixes, compare lowercase
    //    Normalise both the mention and DB values to catch "BHP Group Ltd" vs "BHP Group"
    if (entityId == null) {
      const normalised = normalizeName(name);
      if (normalised.length > 1) {
        const { rows: normRows } = await pool.query<{ id: number }>(
          `SELECT id FROM entities
           WHERE entity_type = $2 AND (
             TRIM(REGEXP_REPLACE(LOWER(canonical_name), '\\m(the|ltd|pty|inc|corp|corporation|limited|group|plc|co)\\M', '', 'gi')) = $1
             OR EXISTS (
               SELECT 1 FROM unnest(aliases) AS a
               WHERE TRIM(REGEXP_REPLACE(LOWER(a), '\\m(the|ltd|pty|inc|corp|corporation|limited|group|plc|co)\\M', '', 'gi')) = $1
             )
           )
           LIMIT 1`,
          [normalised, entityType]
        );
        if (normRows.length > 0) {
          entityId = normRows[0].id;
          // Add the original mention as alias for future exact matching
          await pool.query(
            `UPDATE entities SET aliases = array_append(aliases, $1)
             WHERE id = $2 AND NOT ($1 = ANY(aliases))`,
            [name, entityId]
          );
        }
      }
    }

    // 4. No match — create new candidate entity
    if (entityId == null) {
      const { rows: insertRows } = await pool.query<{ id: number }>(
        `INSERT INTO entities (canonical_name, entity_type, status, mention_count, aliases)
         VALUES ($1, $2, 'candidate', 1, ARRAY[]::TEXT[])
         ON CONFLICT (canonical_name, entity_type) DO UPDATE SET
           mention_count = entities.mention_count + 1,
           last_seen_at = NOW()
         RETURNING id`,
        [name, entityType]
      );
      entityId = insertRows[0].id;
      created = true;
    } else {
      // Increment mention_count and update last_seen_at for matched entities
      await pool.query(
        `UPDATE entities SET mention_count = mention_count + 1, last_seen_at = NOW() WHERE id = $1`,
        [entityId]
      );
    }

    results.push({ entityId, role: mention.role, created });
  }

  return results;
}

/**
 * Promote eligible candidate entities based on role-aware, type-specific thresholds.
 *
 * Promotion rules:
 * - Company: 3+ stories as subject/actor across 2+ distinct days
 * - Project: 2+ stories as subject across 2+ distinct days
 * - Person: 3+ stories as subject/actor across 3+ distinct days
 * - Regulation: 2+ stories as subject across 2+ distinct days
 * - Technology: 3+ stories as subject across 2+ distinct days
 *
 * Returns the count of newly promoted entities.
 */
export async function promoteEligibleEntities(): Promise<number> {
  const { rowCount } = await pool.query(
    `UPDATE entities SET status = 'promoted'
     WHERE status = 'candidate' AND id IN (
       SELECT e.id FROM entities e
       JOIN article_entities ae ON ae.entity_id = e.id
       JOIN enriched_articles ea ON ea.id = ae.enriched_article_id
       WHERE e.status = 'candidate'
       GROUP BY e.id, e.entity_type
       HAVING
         (e.entity_type = 'company'
           AND COUNT(DISTINCT ea.id) FILTER (WHERE ae.role IN ('subject','actor')) >= 3
           AND COUNT(DISTINCT DATE(ea.enriched_at)) >= 2)
         OR (e.entity_type = 'project'
           AND COUNT(DISTINCT ea.id) FILTER (WHERE ae.role = 'subject') >= 2
           AND COUNT(DISTINCT DATE(ea.enriched_at)) >= 2)
         OR (e.entity_type = 'person'
           AND COUNT(DISTINCT ea.id) FILTER (WHERE ae.role IN ('subject','actor')) >= 3
           AND COUNT(DISTINCT DATE(ea.enriched_at)) >= 3)
         OR (e.entity_type = 'regulation'
           AND COUNT(DISTINCT ea.id) FILTER (WHERE ae.role = 'subject') >= 2
           AND COUNT(DISTINCT DATE(ea.enriched_at)) >= 2)
         OR (e.entity_type = 'technology'
           AND COUNT(DISTINCT ea.id) FILTER (WHERE ae.role = 'subject') >= 3
           AND COUNT(DISTINCT DATE(ea.enriched_at)) >= 2)
     )`
  );
  return rowCount ?? 0;
}

/**
 * Mark promoted entities as dormant if they haven't appeared in any story for 90 days.
 * Dormant entities are excluded from prompt context but remain in registry for history.
 * Returns the count of newly dormant entities.
 */
export async function markDormantEntities(): Promise<number> {
  const { rowCount } = await pool.query(
    `UPDATE entities SET status = 'dormant'
     WHERE status = 'promoted'
     AND last_seen_at < NOW() - INTERVAL '90 days'`
  );
  return rowCount ?? 0;
}
