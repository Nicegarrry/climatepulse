import pool from "@/lib/db";

/**
 * Ensure every non-deprecated taxonomy_microsectors row has a matching
 * microsector_briefs row. Idempotent; existing rows are never touched.
 */
export async function ensureBriefRows(): Promise<number> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO microsector_briefs
       (microsector_id, title, primary_domain, editorial_status, version)
     SELECT
       tm.id,
       tm.name,
       td.slug,
       'ai_drafted',
       1
     FROM taxonomy_microsectors tm
     JOIN taxonomy_sectors ts ON ts.id = tm.sector_id
     JOIN taxonomy_domains td ON td.id = ts.domain_id
     WHERE tm.deprecated_at IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM microsector_briefs mb WHERE mb.microsector_id = tm.id
       )
     RETURNING id`,
  );
  const inserted = rows.length;
  console.log(
    inserted > 0
      ? `[seeder] created ${inserted} microsector_briefs rows`
      : "[seeder] all microsector_briefs already exist",
  );
  return inserted;
}
