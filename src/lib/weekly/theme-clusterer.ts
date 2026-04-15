import pool from "@/lib/db";
import type { WeeklyThemeCluster } from "@/lib/types";

// ─── Types for internal use ────────────────────────────────────────────────

interface WeekArticle {
  id: string;
  title: string;
  source_name: string;
  article_url: string;
  significance_composite: number;
  primary_domain: string;
  secondary_domain: string | null;
  signal_type: string;
  sentiment: string;
  microsector_ids: number[];
  quantitative_data: {
    primary_metric?: { value: string; unit: string; context: string };
    delta?: { value: string; unit: string; context: string; period: string };
  } | null;
  transmission_channels_triggered: string[];
  entities: { id: number; name: string; type: string; role: string }[];
}

// ─── Fetch week's articles ─────────────────────────────────────────────────

export async function fetchWeekArticles(
  weekStart: string,
  weekEnd: string,
  minSignificance = 40
): Promise<WeekArticle[]> {
  const result = await pool.query(
    `SELECT
      ea.id, ea.primary_domain, ea.secondary_domain,
      ea.signal_type, ea.sentiment, ea.microsector_ids,
      ea.significance_composite, ea.quantitative_data,
      ea.transmission_channels_triggered,
      ra.title, ra.source_name, ra.article_url,
      COALESCE(
        (SELECT json_agg(json_build_object(
          'id', e.id, 'name', e.canonical_name, 'type', e.entity_type, 'role', ae.role
        ))
         FROM article_entities ae
         JOIN entities e ON e.id = ae.entity_id
         WHERE ae.enriched_article_id = ea.id), '[]'
      ) as entities_joined
    FROM enriched_articles ea
    JOIN raw_articles ra ON ra.id = ea.raw_article_id
    WHERE ra.published_at >= $1::date
      AND ra.published_at < ($2::date + INTERVAL '1 day')
      AND ea.significance_composite IS NOT NULL
      AND ea.significance_composite >= $3
    ORDER BY ea.significance_composite DESC`,
    [weekStart, weekEnd, minSignificance]
  );

  return result.rows.map((row) => ({
    ...row,
    significance_composite: Number(row.significance_composite) || 0,
    microsector_ids: row.microsector_ids ?? [],
    transmission_channels_triggered: row.transmission_channels_triggered ?? [],
    entities: row.entities_joined ?? [],
  }));
}

// ─── Cluster by domain + shared entities ───────────────────────────────────

export function clusterArticles(articles: WeekArticle[]): WeeklyThemeCluster[] {
  if (articles.length === 0) return [];

  // Step 1: Group by primary_domain
  const domainGroups = new Map<string, WeekArticle[]>();
  for (const article of articles) {
    const domain = article.primary_domain || "uncategorised";
    const group = domainGroups.get(domain) || [];
    group.push(article);
    domainGroups.set(domain, group);
  }

  const clusters: WeeklyThemeCluster[] = [];
  let clusterId = 0;

  for (const [domain, domainArticles] of domainGroups) {
    // Step 2: Find sub-clusters within domain by shared entities
    const subClusters = findEntitySubClusters(domainArticles);

    for (const subCluster of subClusters) {
      clusterId++;
      const entityNames = findSharedEntities(subCluster);
      const sentimentAgg = aggregateSentiment(subCluster);
      const keyNumbers = extractKeyNumbers(subCluster);
      const totalSignificance = subCluster.reduce(
        (sum, a) => sum + a.significance_composite,
        0
      );

      clusters.push({
        cluster_id: `c${clusterId}`,
        label: generateClusterLabel(domain, entityNames, subCluster),
        domain,
        articles: subCluster.map((a) => ({
          id: a.id,
          title: a.title,
          source: a.source_name,
          url: a.article_url,
          significance: a.significance_composite,
        })),
        entity_overlap: entityNames,
        sentiment_agg: sentimentAgg,
        key_numbers: keyNumbers,
      });
    }
  }

  // Sort clusters by total significance (sum of member articles)
  clusters.sort((a, b) => {
    const sumA = a.articles.reduce((s, art) => s + art.significance, 0);
    const sumB = b.articles.reduce((s, art) => s + art.significance, 0);
    return sumB - sumA;
  });

  return clusters;
}

// ─── Sub-cluster by shared entities ────────────────────────────────────────

function findEntitySubClusters(articles: WeekArticle[]): WeekArticle[][] {
  if (articles.length <= 2) return [articles];

  // Build entity -> article index
  const entityArticles = new Map<string, Set<number>>();
  for (let i = 0; i < articles.length; i++) {
    for (const entity of articles[i].entities) {
      const key = entity.name.toLowerCase();
      const set = entityArticles.get(key) || new Set();
      set.add(i);
      entityArticles.set(key, set);
    }
  }

  // Find entity groups with 2+ shared articles
  const assigned = new Set<number>();
  const subClusters: WeekArticle[][] = [];

  // Sort entities by article count (largest clusters first)
  const sortedEntities = [...entityArticles.entries()]
    .filter(([, indices]) => indices.size >= 2)
    .sort((a, b) => b[1].size - a[1].size);

  for (const [, indices] of sortedEntities) {
    const unassigned = [...indices].filter((i) => !assigned.has(i));
    if (unassigned.length >= 2) {
      const cluster = unassigned.map((i) => articles[i]);
      subClusters.push(cluster);
      unassigned.forEach((i) => assigned.add(i));
    }
  }

  // Also try microsector overlap for remaining articles
  const remaining = articles.filter((_, i) => !assigned.has(i));
  if (remaining.length >= 2) {
    const msGroups = groupByMicrosectorOverlap(remaining);
    for (const group of msGroups) {
      if (group.length >= 2) {
        subClusters.push(group);
      } else {
        // Single articles go to remainder
      }
    }
    // Collect true remainders
    const allGrouped = new Set(msGroups.flat().map((a) => a.id));
    const trueRemainder = remaining.filter((a) => !allGrouped.has(a.id));
    if (trueRemainder.length > 0) {
      subClusters.push(trueRemainder);
    }
  } else if (remaining.length === 1) {
    // Merge single remaining article into the largest cluster
    if (subClusters.length > 0) {
      subClusters[0].push(remaining[0]);
    } else {
      subClusters.push(remaining);
    }
  }

  // If no sub-clusters were found, return all articles as one cluster
  if (subClusters.length === 0) return [articles];

  return subClusters;
}

function groupByMicrosectorOverlap(articles: WeekArticle[]): WeekArticle[][] {
  if (articles.length <= 1) return [articles];

  const groups: WeekArticle[][] = [];
  const used = new Set<string>();

  for (let i = 0; i < articles.length; i++) {
    if (used.has(articles[i].id)) continue;
    const group = [articles[i]];
    used.add(articles[i].id);

    for (let j = i + 1; j < articles.length; j++) {
      if (used.has(articles[j].id)) continue;
      const shared = articles[i].microsector_ids.filter((id) =>
        articles[j].microsector_ids.includes(id)
      );
      if (shared.length >= 2) {
        group.push(articles[j]);
        used.add(articles[j].id);
      }
    }

    groups.push(group);
  }

  return groups;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function findSharedEntities(articles: WeekArticle[]): string[] {
  if (articles.length <= 1) return articles[0]?.entities.map((e) => e.name) ?? [];

  const entityCounts = new Map<string, number>();
  for (const article of articles) {
    const seen = new Set<string>();
    for (const entity of article.entities) {
      if (!seen.has(entity.name)) {
        entityCounts.set(entity.name, (entityCounts.get(entity.name) || 0) + 1);
        seen.add(entity.name);
      }
    }
  }

  return [...entityCounts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
}

function aggregateSentiment(articles: WeekArticle[]) {
  const agg = { positive: 0, negative: 0, neutral: 0, mixed: 0 };
  for (const article of articles) {
    const s = article.sentiment as keyof typeof agg;
    if (s in agg) agg[s]++;
  }
  return agg;
}

function extractKeyNumbers(articles: WeekArticle[]) {
  const numbers: { value: string; unit: string; context: string }[] = [];
  for (const article of articles) {
    if (article.quantitative_data?.primary_metric) {
      const m = article.quantitative_data.primary_metric;
      numbers.push({ value: m.value, unit: m.unit, context: m.context });
    }
  }
  return numbers;
}

const DOMAIN_LABELS: Record<string, string> = {
  "carbon-emissions": "Carbon & Emissions",
  "energy-storage": "Energy Storage",
  "energy-generation": "Energy Generation",
  "energy-grid": "Grid & Transmission",
  transport: "Transport",
  industry: "Industry",
  agriculture: "Agriculture",
  "built-environment": "Built Environment",
  "critical-minerals": "Critical Minerals",
  finance: "Climate Finance",
  policy: "Policy & Regulation",
  "workforce-adaptation": "Workforce & Adaptation",
};

function generateClusterLabel(
  domain: string,
  sharedEntities: string[],
  articles: WeekArticle[]
): string {
  const domainLabel = DOMAIN_LABELS[domain] || domain.replace(/-/g, " ");

  // If shared entities exist, use the top entity as a specificity anchor
  if (sharedEntities.length > 0) {
    return `${domainLabel}: ${sharedEntities.slice(0, 2).join(" & ")}`;
  }

  // Fallback: domain + signal type summary
  const signalCounts = new Map<string, number>();
  for (const a of articles) {
    if (a.signal_type) {
      signalCounts.set(a.signal_type, (signalCounts.get(a.signal_type) || 0) + 1);
    }
  }

  const topSignal = [...signalCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topSignal) {
    const signalLabels: Record<string, string> = {
      market_move: "Market Movements",
      policy_change: "Policy Developments",
      project_milestone: "Project Progress",
      corporate_action: "Corporate Activity",
      technology_advance: "Technology Advances",
      international: "International Signals",
    };
    return `${domainLabel}: ${signalLabels[topSignal[0]] || "Developments"}`;
  }

  return `${domainLabel} Developments`;
}
