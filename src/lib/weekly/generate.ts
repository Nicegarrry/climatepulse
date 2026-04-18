import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_MODEL } from "@/lib/ai-models";
import pool from "@/lib/db";
import { fetchWeekArticles, clusterArticles } from "@/lib/weekly/theme-clusterer";
import type { WeeklyThemeCluster } from "@/lib/types";

export interface GenerateWeeklyReportResult {
  id: string;
  weekStart: string;
  weekEnd: string;
  clusters: number;
  articles: number;
  topNumbers: number;
  storylines: number;
  status: "ready";
}

export function getDefaultWeekRange(): { weekStart: string; weekEnd: string } {
  const now = new Date();
  const daysSinceSunday = now.getDay();
  const lastSunday = new Date(now);
  lastSunday.setDate(now.getDate() - (daysSinceSunday === 0 ? 7 : daysSinceSunday));
  const lastMonday = new Date(lastSunday);
  lastMonday.setDate(lastSunday.getDate() - 6);
  return {
    weekStart: lastMonday.toISOString().slice(0, 10),
    weekEnd: lastSunday.toISOString().slice(0, 10),
  };
}

async function refineClusterLabels(
  clusters: WeeklyThemeCluster[]
): Promise<WeeklyThemeCluster[]> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey || clusters.length === 0) return clusters;
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    const summaries = clusters.map((c, i) => {
      const headlines = c.articles.map((a) => a.title).join("; ");
      const entities = c.entity_overlap.join(", ") || "none";
      return `[${i + 1}] Domain: ${c.domain} | Headlines: ${headlines} | Shared entities: ${entities}`;
    });
    const prompt = `You are a climate/energy editor. Given these article clusters from the past week, generate a concise narrative label (5-10 words) for each cluster that captures the key theme or development. Return ONLY a JSON array of strings, one label per cluster.

Clusters:
${summaries.join("\n")}

Return format: ["label1", "label2", ...]`;
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const m = text.match(/\[[\s\S]*\]/);
    if (m) {
      const labels: string[] = JSON.parse(m[0]);
      return clusters.map((c, i) => ({ ...c, label: labels[i] || c.label }));
    }
  } catch (err) {
    console.warn("Cluster label refinement failed:", err);
  }
  return clusters;
}

function extractTopNumbers(
  clusters: WeeklyThemeCluster[]
): { value: string; unit: string; context: string; source_article_id: string; delta?: string }[] {
  const all: { value: string; unit: string; context: string; articleId: string }[] = [];
  for (const cluster of clusters) {
    for (let i = 0; i < cluster.articles.length; i++) {
      const article = cluster.articles[i];
      if (cluster.key_numbers[i]) {
        all.push({ ...cluster.key_numbers[i], articleId: article.id });
      }
    }
    for (let i = cluster.articles.length; i < cluster.key_numbers.length; i++) {
      all.push({ ...cluster.key_numbers[i], articleId: cluster.articles[0]?.id || "" });
    }
  }
  return all.slice(0, 5).map((n) => ({
    value: n.value,
    unit: n.unit,
    context: n.context,
    source_article_id: n.articleId,
  }));
}

async function fetchStorylineUpdates(weekStart: string, weekEnd: string) {
  try {
    const { rows } = await pool.query(
      `SELECT s.id, s.title, COUNT(sa.enriched_article_id) as article_count,
              MAX(ra.title) as latest_title
       FROM storylines s
       JOIN storyline_articles sa ON sa.storyline_id = s.id
       JOIN enriched_articles ea ON ea.id = sa.enriched_article_id
       JOIN raw_articles ra ON ra.id = ea.raw_article_id
       WHERE s.status = 'active'
         AND ra.published_at >= $1::date
         AND ra.published_at < ($2::date + INTERVAL '1 day')
       GROUP BY s.id, s.title
       ORDER BY COUNT(sa.enriched_article_id) DESC
       LIMIT 10`,
      [weekStart, weekEnd]
    );
    return rows.map((r) => ({
      storyline_id: r.id,
      title: r.title,
      article_count: Number(r.article_count),
      latest_development: r.latest_title || "",
    }));
  } catch {
    return [];
  }
}

async function fetchTransmissionActivity(weekStart: string, weekEnd: string) {
  try {
    const { rows } = await pool.query(
      `SELECT unnest(ea.transmission_channels_triggered) as channel,
              COUNT(*) as triggered_count,
              array_agg(ea.id ORDER BY ea.significance_composite DESC) as article_ids
       FROM enriched_articles ea
       JOIN raw_articles ra ON ra.id = ea.raw_article_id
       WHERE ra.published_at >= $1::date
         AND ra.published_at < ($2::date + INTERVAL '1 day')
         AND ea.transmission_channels_triggered IS NOT NULL
         AND array_length(ea.transmission_channels_triggered, 1) > 0
       GROUP BY channel
       ORDER BY COUNT(*) DESC
       LIMIT 10`,
      [weekStart, weekEnd]
    );
    return rows.map((r) => ({
      channel_label: r.channel,
      triggered_count: Number(r.triggered_count),
      example_article_ids: (r.article_ids || []).slice(0, 3),
    }));
  } catch {
    return [];
  }
}

function buildSentimentSummary(clusters: WeeklyThemeCluster[]) {
  const byDomain: Record<string, Record<string, number>> = {};
  let tp = 0, tn = 0, tneu = 0;
  for (const c of clusters) {
    const d = c.domain;
    if (!byDomain[d]) byDomain[d] = { positive: 0, negative: 0, neutral: 0, mixed: 0 };
    byDomain[d].positive += c.sentiment_agg.positive;
    byDomain[d].negative += c.sentiment_agg.negative;
    byDomain[d].neutral += c.sentiment_agg.neutral;
    byDomain[d].mixed += c.sentiment_agg.mixed;
    tp += c.sentiment_agg.positive;
    tn += c.sentiment_agg.negative;
    tneu += c.sentiment_agg.neutral;
  }
  const overall = tp > tn * 1.5 ? "positive" : tn > tp * 1.5 ? "negative" : "mixed";
  void tneu;
  return { overall, by_domain: byDomain };
}

export async function generateWeeklyReport(
  weekStartInput?: string
): Promise<GenerateWeeklyReportResult> {
  const { weekStart, weekEnd } = weekStartInput
    ? {
        weekStart: weekStartInput,
        weekEnd: (() => {
          const d = new Date(weekStartInput + "T00:00:00");
          d.setDate(d.getDate() + 6);
          return d.toISOString().slice(0, 10);
        })(),
      }
    : getDefaultWeekRange();

  console.log(`Weekly report: generating for ${weekStart} to ${weekEnd}`);

  const articles = await fetchWeekArticles(weekStart, weekEnd);
  if (articles.length === 0) {
    throw new Error(`No enriched articles found for ${weekStart}..${weekEnd}`);
  }

  let clusters = clusterArticles(articles);
  console.log(`Weekly report: ${articles.length} articles in ${clusters.length} clusters`);
  clusters = await refineClusterLabels(clusters);
  const topNumbers = extractTopNumbers(clusters);
  const [storylineUpdates, transmissionActivity] = await Promise.all([
    fetchStorylineUpdates(weekStart, weekEnd),
    fetchTransmissionActivity(weekStart, weekEnd),
  ]);
  const sentimentSummary = buildSentimentSummary(clusters);

  const reportId = `wreport-${Date.now()}`;
  const articleIds = articles.map((a) => a.id);

  await pool.query(
    `INSERT INTO weekly_reports (
      id, week_start, week_end, status,
      theme_clusters, top_numbers, sentiment_summary,
      storyline_updates, transmission_activity,
      article_ids_included, model_used, generated_at
    ) VALUES ($1, $2, $3, 'ready', $4, $5, $6, $7, $8, $9, $10, NOW())
    ON CONFLICT (week_start) DO UPDATE SET
      status = 'ready',
      theme_clusters = EXCLUDED.theme_clusters,
      top_numbers = EXCLUDED.top_numbers,
      sentiment_summary = EXCLUDED.sentiment_summary,
      storyline_updates = EXCLUDED.storyline_updates,
      transmission_activity = EXCLUDED.transmission_activity,
      article_ids_included = EXCLUDED.article_ids_included,
      model_used = EXCLUDED.model_used,
      generated_at = NOW()`,
    [
      reportId,
      weekStart,
      weekEnd,
      JSON.stringify(clusters),
      JSON.stringify(topNumbers),
      JSON.stringify(sentimentSummary),
      JSON.stringify(storylineUpdates),
      JSON.stringify(transmissionActivity),
      articleIds,
      GEMINI_MODEL,
    ]
  );

  try {
    const { embedWeeklyReport } = await import("@/lib/intelligence/embedder");
    await embedWeeklyReport(reportId);
  } catch (embedErr) {
    console.warn("Failed to embed weekly report:", embedErr);
  }

  return {
    id: reportId,
    weekStart,
    weekEnd,
    clusters: clusters.length,
    articles: articles.length,
    topNumbers: topNumbers.length,
    storylines: storylineUpdates.length,
    status: "ready",
  };
}
