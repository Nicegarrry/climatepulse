import type { TaxonomyTreeNode } from "@/lib/types";

/**
 * Expand a user's primary_sectors (which may contain domain slugs,
 * sector slugs, or microsector slugs) into a flat Set of microsector slugs.
 *
 * If a domain slug is found, ALL child microsectors are included.
 * If a sector slug is found, ALL child microsectors under that sector are included.
 * If a microsector slug is found, it's included as-is.
 */
export function expandToMicrosectorSlugs(
  primarySectors: string[],
  tree: TaxonomyTreeNode[]
): Set<string> {
  // Build lookup maps from the tree
  const domainToMicrosectors = new Map<string, string[]>();
  const sectorToMicrosectors = new Map<string, string[]>();
  const allMicrosectorSlugs = new Set<string>();

  for (const node of tree) {
    const domainSlug = node.domain.slug;
    const domainMicros: string[] = [];

    for (const sec of node.sectors) {
      const sectorSlug = sec.sector.slug;
      const sectorMicros: string[] = [];

      for (const ms of sec.microsectors) {
        sectorMicros.push(ms.slug);
        allMicrosectorSlugs.add(ms.slug);
      }

      sectorToMicrosectors.set(sectorSlug, sectorMicros);
      domainMicros.push(...sectorMicros);
    }

    domainToMicrosectors.set(domainSlug, domainMicros);
  }

  // Expand user selections
  const expanded = new Set<string>();

  for (const slug of primarySectors) {
    // Check if it's a domain slug
    const domainExpansion = domainToMicrosectors.get(slug);
    if (domainExpansion) {
      for (const ms of domainExpansion) expanded.add(ms);
      continue;
    }

    // Check if it's a sector slug
    const sectorExpansion = sectorToMicrosectors.get(slug);
    if (sectorExpansion) {
      for (const ms of sectorExpansion) expanded.add(ms);
      continue;
    }

    // Assume it's a microsector slug (add it if it exists in the tree)
    if (allMicrosectorSlugs.has(slug)) {
      expanded.add(slug);
    }
  }

  return expanded;
}
