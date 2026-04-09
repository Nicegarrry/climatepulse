import pool from "@/lib/db";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_MODEL } from "@/lib/ai-models";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");

interface StorylineMatch {
  storyline_id: number;
  enriched_article_id: string;
  match_reason: string;
}

interface StorylineCandidate {
  title: string;
  description: string;
  entity_ids: number[];
  microsector_slugs: string[];
  domain_ids: number[];
  signal_types: string[];
  article_ids: string[];
}

/**
 * Run storyline discovery after an enrichment batch.
 * 1. Match newly enriched articles to existing active storylines
 * 2. Discover new storyline candidates from article clusters
 * Returns counts of matched and suggested storylines.
 */
export async function discoverStorylines(
  newArticleIds: string[]
): Promise<{ matched: number; suggested: number }> {
  if (newArticleIds.length === 0) return { matched: 0, suggested: 0 };

  let matched = 0;
  let suggested = 0;

  // Step 1: Match new articles to existing active storylines
  matched = await matchToExistingStorylines(newArticleIds);

  // Step 2: Find article clusters that could form new storylines
  const candidates = await findStorylineCandidates(newArticleIds);
  if (candidates.length > 0) {
    suggested = await createSuggestedStorylines(candidates);
  }

  return { matched, suggested };
}

/**
 * Match new articles against existing active storylines.
 * An article matches if it shares 2+ criteria with a storyline:
 * - Same entity (via article_entities join)
 * - Same microsector (via enriched_articles.microsector_ids)
 * - Same domain (via primary_domain)
 */
async function matchToExistingStorylines(articleIds: string[]): Promise<number> {
  const { rows: storylines } = await pool.query(
    `SELECT id, entity_ids, microsector_slugs, domain_ids, signal_types
     FROM storylines WHERE status = 'active'`
  );

  if (storylines.length === 0) return 0;

  // Fetch article data for matching
  const { rows: articles } = await pool.query(
    `SELECT ea.id, ea.microsector_ids, ea.primary_domain, ea.signal_type,
            ARRAY_AGG(DISTINCT ae.entity_id) FILTER (WHERE ae.entity_id IS NOT NULL) AS entity_ids
     FROM enriched_articles ea
     LEFT JOIN article_entities ae ON ae.enriched_article_id = ea.id
     WHERE ea.id = ANY($1)
     GROUP BY ea.id`,
    [articleIds]
  );

  // Get microsector slugs for the article microsector IDs
  const allMsIds = [...new Set(articles.flatMap((a) => a.microsector_ids || []))];
  const msSlugMap = new Map<number, string>();
  if (allMsIds.length > 0) {
    const { rows: msSlugs } = await pool.query(
      `SELECT id, slug FROM taxonomy_microsectors WHERE id = ANY($1)`,
      [allMsIds]
    );
    for (const ms of msSlugs) msSlugMap.set(ms.id, ms.slug);
  }

  // Get domain IDs from slugs
  const { rows: domainRows } = await pool.query(
    `SELECT id, slug FROM taxonomy_domains`
  );
  const domainSlugToId = new Map(domainRows.map((d) => [d.slug, d.id]));

  const matches: StorylineMatch[] = [];

  for (const article of articles) {
    const articleEntityIds = (article.entity_ids || []).map(Number);
    const articleMsSlugs = (article.microsector_ids || []).map((id: number) => msSlugMap.get(id)).filter(Boolean) as string[];
    const articleDomainId = domainSlugToId.get(article.primary_domain);

    for (const storyline of storylines) {
      let matchCount = 0;
      const reasons: string[] = [];

      // Check entity overlap
      const entityOverlap = articleEntityIds.filter((id: number) =>
        (storyline.entity_ids || []).includes(id)
      );
      if (entityOverlap.length > 0) {
        matchCount++;
        reasons.push(`shared entity (${entityOverlap.length})`);
      }

      // Check microsector overlap
      const msOverlap = articleMsSlugs.filter((slug: string) =>
        (storyline.microsector_slugs || []).includes(slug)
      );
      if (msOverlap.length > 0) {
        matchCount++;
        reasons.push(`overlapping microsector: ${msOverlap[0]}`);
      }

      // Check domain overlap
      if (articleDomainId && (storyline.domain_ids || []).includes(articleDomainId)) {
        matchCount++;
        reasons.push("same domain");
      }

      // Check signal type overlap
      if (article.signal_type && (storyline.signal_types || []).includes(article.signal_type)) {
        matchCount++;
        reasons.push(`same signal: ${article.signal_type}`);
      }

      // Require at least 2 matching criteria
      if (matchCount >= 2) {
        matches.push({
          storyline_id: storyline.id,
          enriched_article_id: article.id,
          match_reason: reasons.join(", "),
        });
      }
    }
  }

  // Insert matches
  for (const match of matches) {
    await pool.query(
      `INSERT INTO storyline_articles (storyline_id, enriched_article_id, match_reason)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [match.storyline_id, match.enriched_article_id, match.match_reason]
    );
    await pool.query(
      `UPDATE storylines SET
        article_count = (SELECT COUNT(*) FROM storyline_articles WHERE storyline_id = $1),
        last_seen_at = NOW()
      WHERE id = $1`,
      [match.storyline_id]
    );
  }

  return matches.length;
}

/**
 * Find clusters of recent articles that share entities or microsectors
 * and could form new storylines.
 */
async function findStorylineCandidates(newArticleIds: string[]): Promise<StorylineCandidate[]> {
  // Find entity-based clusters: entities that appear in 3+ articles in the last 7 days
  const { rows: entityClusters } = await pool.query(
    `SELECT ae.entity_id, e.canonical_name, e.entity_type,
            ARRAY_AGG(DISTINCT ae.enriched_article_id) AS article_ids,
            COUNT(DISTINCT ae.enriched_article_id) AS article_count
     FROM article_entities ae
     JOIN enriched_articles ea ON ea.id = ae.enriched_article_id
     JOIN entities e ON e.id = ae.entity_id
     WHERE ea.enriched_at > NOW() - INTERVAL '7 days'
       AND e.status IN ('promoted', 'candidate')
       AND ae.role IN ('subject', 'actor')
     GROUP BY ae.entity_id, e.canonical_name, e.entity_type
     HAVING COUNT(DISTINCT ae.enriched_article_id) >= 3
     ORDER BY article_count DESC
     LIMIT 10`
  );

  const candidates: StorylineCandidate[] = [];

  for (const cluster of entityClusters) {
    const clusterArticleIds = cluster.article_ids as string[];

    // Check if any of these articles are in the new batch
    const hasNewArticle = clusterArticleIds.some((id: string) => newArticleIds.includes(id));
    if (!hasNewArticle) continue;

    // Check if this cluster is already covered by an existing storyline
    const { rows: existing } = await pool.query(
      `SELECT id FROM storylines WHERE $1 = ANY(entity_ids) AND status IN ('active', 'suggested')`,
      [cluster.entity_id]
    );
    if (existing.length > 0) continue;

    // Gather metadata from the cluster's articles
    const { rows: articleData } = await pool.query(
      `SELECT ea.microsector_ids, ea.primary_domain, ea.signal_type
       FROM enriched_articles ea WHERE ea.id = ANY($1)`,
      [clusterArticleIds]
    );

    const { rows: domainRows } = await pool.query(`SELECT id, slug FROM taxonomy_domains`);
    const domainSlugToId = new Map(domainRows.map((d) => [d.slug, d.id]));

    const allMsIds = [...new Set(articleData.flatMap((a) => a.microsector_ids || []))];
    const msSlugMap = new Map<number, string>();
    if (allMsIds.length > 0) {
      const { rows: msSlugs } = await pool.query(
        `SELECT id, slug FROM taxonomy_microsectors WHERE id = ANY($1)`,
        [allMsIds]
      );
      for (const ms of msSlugs) msSlugMap.set(ms.id, ms.slug);
    }

    candidates.push({
      title: "", // Will be generated by Gemini
      description: "",
      entity_ids: [cluster.entity_id],
      microsector_slugs: [...new Set(allMsIds.map((id) => msSlugMap.get(id)).filter(Boolean))] as string[],
      domain_ids: [...new Set(
        articleData.map((a) => domainSlugToId.get(a.primary_domain)).filter(Boolean)
      )] as number[],
      signal_types: [...new Set(articleData.map((a) => a.signal_type).filter(Boolean))] as string[],
      article_ids: clusterArticleIds,
    });
  }

  return candidates.slice(0, 5); // Max 5 suggestions per batch
}

/**
 * Use Gemini to generate titles and descriptions for storyline candidates,
 * then insert as 'suggested' storylines.
 */
async function createSuggestedStorylines(candidates: StorylineCandidate[]): Promise<number> {
  // Fetch article titles for context
  const allArticleIds = [...new Set(candidates.flatMap((c) => c.article_ids))];
  const { rows: articles } = await pool.query(
    `SELECT ea.id, ra.title
     FROM enriched_articles ea
     JOIN raw_articles ra ON ra.id = ea.raw_article_id
     WHERE ea.id = ANY($1)`,
    [allArticleIds]
  );
  const titleMap = new Map(articles.map((a) => [a.id, a.title]));

  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  const clustersContext = candidates.map((c, i) => {
    const titles = c.article_ids.map((id) => titleMap.get(id) || "Untitled").join("; ");
    return `Cluster ${i + 1} (${c.article_ids.length} articles):\nArticles: ${titles}\nSectors: ${c.microsector_slugs.join(", ")}\nSignals: ${c.signal_types.join(", ")}`;
  }).join("\n\n");

  const prompt = `You are analyzing clusters of related climate/energy news articles. For each cluster, generate a short storyline title (5-10 words, like a saga name) and a one-sentence description.

${clustersContext}

Respond in JSON: { "storylines": [{ "cluster": 1, "title": "...", "description": "..." }] }`;

  try {
    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();
    if (text.startsWith("```")) {
      text = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    const parsed = JSON.parse(text);

    let created = 0;
    for (const s of parsed.storylines || []) {
      const idx = (s.cluster as number) - 1;
      const candidate = candidates[idx];
      if (!candidate) continue;

      const { rows } = await pool.query(
        `INSERT INTO storylines (title, description, entity_ids, microsector_slugs, domain_ids, signal_types, status, article_count, first_seen_at, last_seen_at, auto_discovered)
         VALUES ($1, $2, $3, $4, $5, $6, 'suggested', $7, NOW(), NOW(), true)
         RETURNING id`,
        [
          s.title,
          s.description,
          candidate.entity_ids,
          candidate.microsector_slugs,
          candidate.domain_ids,
          candidate.signal_types,
          candidate.article_ids.length,
        ]
      );

      const storylineId = rows[0].id;
      for (const articleId of candidate.article_ids) {
        await pool.query(
          `INSERT INTO storyline_articles (storyline_id, enriched_article_id, match_reason)
           VALUES ($1, $2, 'initial cluster member') ON CONFLICT DO NOTHING`,
          [storylineId, articleId]
        );
      }
      created++;
    }

    return created;
  } catch (err) {
    console.error("Failed to generate storyline titles:", err);
    // Still create storylines with placeholder titles
    let created = 0;
    for (const candidate of candidates) {
      const { rows } = await pool.query(
        `INSERT INTO storylines (title, description, entity_ids, microsector_slugs, domain_ids, signal_types, status, article_count, first_seen_at, last_seen_at, auto_discovered)
         VALUES ($1, $2, $3, $4, $5, $6, 'suggested', $7, NOW(), NOW(), true)
         RETURNING id`,
        [
          `Emerging storyline (${candidate.article_ids.length} articles)`,
          "Auto-discovered cluster — needs review",
          candidate.entity_ids,
          candidate.microsector_slugs,
          candidate.domain_ids,
          candidate.signal_types,
          candidate.article_ids.length,
        ]
      );

      const storylineId = rows[0].id;
      for (const articleId of candidate.article_ids) {
        await pool.query(
          `INSERT INTO storyline_articles (storyline_id, enriched_article_id, match_reason)
           VALUES ($1, $2, 'initial cluster member') ON CONFLICT DO NOTHING`,
          [storylineId, articleId]
        );
      }
      created++;
    }
    return created;
  }
}
