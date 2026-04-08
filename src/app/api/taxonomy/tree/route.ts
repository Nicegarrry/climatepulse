import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT
        d.id as domain_id, d.slug as domain_slug, d.name as domain_name, d.description as domain_desc, d.sort_order as domain_sort,
        s.id as sector_id, s.slug as sector_slug, s.name as sector_name, s.description as sector_desc, s.sort_order as sector_sort,
        m.id as micro_id, m.slug as micro_slug, m.name as micro_name, m.description as micro_desc, m.keywords, m.sort_order as micro_sort,
        COALESCE(ac.article_count, 0) as article_count
      FROM taxonomy_domains d
      LEFT JOIN taxonomy_sectors s ON s.domain_id = d.id
      LEFT JOIN taxonomy_microsectors m ON m.sector_id = s.id
      LEFT JOIN (
        SELECT mid as microsector_id, COUNT(DISTINCT ea.id) as article_count
        FROM enriched_articles ea, UNNEST(ea.microsector_ids) as mid
        GROUP BY mid
      ) ac ON ac.microsector_id = m.id
      ORDER BY d.sort_order, s.sort_order, m.sort_order
    `);

    const domainsMap = new Map<number, any>();

    for (const row of result.rows) {
      if (!domainsMap.has(row.domain_id)) {
        domainsMap.set(row.domain_id, {
          id: row.domain_id,
          slug: row.domain_slug,
          name: row.domain_name,
          description: row.domain_desc,
          sort_order: row.domain_sort,
          article_count: 0,
          sectors: [],
        });
      }

      const domain = domainsMap.get(row.domain_id);

      if (row.sector_id) {
        let sector = domain.sectors.find((s: any) => s.id === row.sector_id);
        if (!sector) {
          sector = {
            id: row.sector_id,
            slug: row.sector_slug,
            name: row.sector_name,
            description: row.sector_desc,
            sort_order: row.sector_sort,
            article_count: 0,
            microsectors: [],
          };
          domain.sectors.push(sector);
        }

        if (row.micro_id) {
          const articleCount = parseInt(row.article_count);
          sector.microsectors.push({
            id: row.micro_id,
            slug: row.micro_slug,
            name: row.micro_name,
            description: row.micro_desc,
            keywords: row.keywords,
            sort_order: row.micro_sort,
            article_count: articleCount,
          });
          sector.article_count += articleCount;
          domain.article_count += articleCount;
        }
      }
    }

    return NextResponse.json({ domains: Array.from(domainsMap.values()) });
  } catch (error) {
    console.error("Error fetching taxonomy tree:", error);
    return NextResponse.json(
      { error: "Failed to fetch taxonomy tree" },
      { status: 500 }
    );
  }
}
