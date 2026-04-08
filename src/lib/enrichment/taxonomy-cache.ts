import pool from "@/lib/db";
import type {
  TaxonomyTreeNode,
  TaxonomyMicrosector,
  Entity,
  TransmissionChannel,
} from "@/lib/types";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let cache: {
  tree: TaxonomyTreeNode[];
  microsectorMap: Map<string, TaxonomyMicrosector>;
  loadedAt: number;
} | null = null;

/**
 * Load the full taxonomy tree from DB and assemble into TaxonomyTreeNode[].
 */
async function loadTree(): Promise<{
  tree: TaxonomyTreeNode[];
  microsectorMap: Map<string, TaxonomyMicrosector>;
}> {
  const { rows } = await pool.query<{
    domain_id: number;
    domain_slug: string;
    domain_name: string;
    domain_desc: string | null;
    domain_sort: number;
    sector_id: number | null;
    sector_slug: string | null;
    sector_name: string | null;
    sector_desc: string | null;
    sector_sort: number | null;
    micro_id: number | null;
    micro_slug: string | null;
    micro_name: string | null;
    micro_desc: string | null;
    keywords: string[] | null;
    micro_sort: number | null;
  }>(`
    SELECT
      d.id as domain_id, d.slug as domain_slug, d.name as domain_name, d.description as domain_desc, d.sort_order as domain_sort,
      s.id as sector_id, s.slug as sector_slug, s.name as sector_name, s.description as sector_desc, s.sort_order as sector_sort,
      m.id as micro_id, m.slug as micro_slug, m.name as micro_name, m.description as micro_desc, m.keywords, m.sort_order as micro_sort
    FROM taxonomy_domains d
    LEFT JOIN taxonomy_sectors s ON s.domain_id = d.id
    LEFT JOIN taxonomy_microsectors m ON m.sector_id = s.id
    ORDER BY d.sort_order, s.sort_order, m.sort_order
  `);

  // Assemble into tree structure
  const domainMap = new Map<number, TaxonomyTreeNode>();
  const sectorMap = new Map<number, { sector: TaxonomyTreeNode["sectors"][0]; domainId: number }>();
  const microsectorMap = new Map<string, TaxonomyMicrosector>();

  for (const row of rows) {
    // Ensure domain node exists
    if (!domainMap.has(row.domain_id)) {
      domainMap.set(row.domain_id, {
        domain: {
          id: row.domain_id,
          slug: row.domain_slug,
          name: row.domain_name,
          description: row.domain_desc,
          sort_order: row.domain_sort,
        },
        sectors: [],
      });
    }

    const domainNode = domainMap.get(row.domain_id)!;

    // Ensure sector node exists (if present in row)
    if (row.sector_id != null && !sectorMap.has(row.sector_id)) {
      const sectorNode = {
        sector: {
          id: row.sector_id,
          domain_id: row.domain_id,
          slug: row.sector_slug!,
          name: row.sector_name!,
          description: row.sector_desc,
          sort_order: row.sector_sort!,
        },
        microsectors: [] as TaxonomyMicrosector[],
      };
      sectorMap.set(row.sector_id, { sector: sectorNode, domainId: row.domain_id });
      domainNode.sectors.push(sectorNode);
    }

    // Add microsector (if present in row)
    if (row.micro_id != null && row.sector_id != null) {
      const micro: TaxonomyMicrosector = {
        id: row.micro_id,
        sector_id: row.sector_id,
        slug: row.micro_slug!,
        name: row.micro_name!,
        description: row.micro_desc,
        keywords: row.keywords ?? [],
        sort_order: row.micro_sort!,
      };
      sectorMap.get(row.sector_id)!.sector.microsectors.push(micro);
      microsectorMap.set(micro.slug, micro);
    }
  }

  const tree = Array.from(domainMap.values());
  return { tree, microsectorMap };
}

/**
 * Ensure the cache is fresh, loading from DB if needed.
 */
async function ensureCache() {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) {
    return cache;
  }
  const { tree, microsectorMap } = await loadTree();
  cache = { tree, microsectorMap, loadedAt: Date.now() };
  return cache;
}

/**
 * Returns the full taxonomy hierarchy for use in prompts and frontend.
 */
export async function getTaxonomyTree(): Promise<TaxonomyTreeNode[]> {
  const c = await ensureCache();
  return c.tree;
}

/**
 * Resolves a microsector slug to its full TaxonomyMicrosector object.
 */
export async function getMicrosectorBySlug(
  slug: string
): Promise<TaxonomyMicrosector | null> {
  const c = await ensureCache();
  return c.microsectorMap.get(slug) ?? null;
}

/**
 * Returns a flat list of all microsectors.
 */
export async function getAllMicrosectors(): Promise<TaxonomyMicrosector[]> {
  const c = await ensureCache();
  return Array.from(c.microsectorMap.values());
}

/**
 * Loads promoted entities for inclusion in prompt context.
 */
export async function getPromotedEntities(): Promise<Entity[]> {
  const { rows } = await pool.query<Entity>(
    `SELECT id, canonical_name, entity_type, aliases, metadata, status,
            mention_count, first_seen_at, last_seen_at, created_at
     FROM entities
     WHERE status = 'promoted'
     ORDER BY mention_count DESC`
  );
  return rows;
}

/**
 * Returns the taxonomy tree filtered to only the specified domain slugs.
 * Pure in-memory filter of the cached tree — no new DB query.
 */
export async function getTreeForDomains(
  domainSlugs: string[]
): Promise<TaxonomyTreeNode[]> {
  const c = await ensureCache();
  const slugSet = new Set(domainSlugs);
  return c.tree.filter((node) => slugSet.has(node.domain.slug));
}

/**
 * Returns the set of known domain slugs from the taxonomy.
 */
export async function getDomainSlugs(): Promise<Set<string>> {
  const c = await ensureCache();
  return new Set(c.tree.map((node) => node.domain.slug));
}

/**
 * Loads transmission channels relevant to the given domain slugs.
 * Returns channels where either the source or target domain matches.
 */
export async function getChannelsForDomains(
  domainSlugs: string[]
): Promise<TransmissionChannel[]> {
  const { rows } = await pool.query<TransmissionChannel>(
    `SELECT tc.*,
      sd.name as source_domain_name, td.name as target_domain_name
    FROM transmission_channels tc
    LEFT JOIN taxonomy_domains sd ON sd.id = tc.source_domain_id
    LEFT JOIN taxonomy_domains td ON td.id = tc.target_domain_id
    WHERE tc.is_active = true
    AND (
      sd.slug = ANY($1)
      OR td.slug = ANY($1)
    )`,
    [domainSlugs]
  );
  return rows;
}

/**
 * Clears the in-memory cache, forcing a reload on next access.
 */
export function invalidateCache(): void {
  cache = null;
}
