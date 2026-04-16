import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_MODEL } from "@/lib/ai-models";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/supabase/server";
import { fetchWeekArticles, clusterArticles } from "@/lib/weekly/theme-clusterer";
import type { WeeklyThemeCluster } from "@/lib/types";

export const maxDuration = 120;

// ─── Helpers ───────────────────────────────────────────────────────────────

function getDefaultWeekRange(): { weekStart: string; weekEnd: string } {
  const now = new Date();
  // Find most recent Sunday (end of last complete week)
  const daysSinceSunday = now.getDay(); // 0=Sun, 1=Mon, ...
  const lastSunday = new Date(now);
  lastSunday.setDate(now.getDate() - (daysSinceSunday === 0 ? 7 : daysSinceSunday));
  const lastMonday = new Date(lastSunday);
  lastMonday.setDate(lastSunday.getDate() - 6);

  return {
    weekStart: lastMonday.toISOString().slice(0, 10),
    weekEnd: lastSunday.toISOString().slice(0, 10),
  };
}

// ─── AI: Generate cluster labels ───────────────────────────────────────────

async function refineClusterLabels(
  clusters: WeeklyThemeCluster[]
): Promise<WeeklyThemeCluster[]> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey || clusters.length === 0) return clusters;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    const clusterSummaries = clusters.map((c, i) => {
      const headlines = c.articles.map((a) => a.title).join("; ");
      const entities = c.entity_overlap.join(", ") || "none";
      return `[${i + 1}] Domain: ${c.domain} | Headlines: ${headlines} | Shared entities: ${entities}`;
    });

    const prompt = `You are a climate/energy editor. Given these article clusters from the past week, generate a concise narrative label (5-10 words) for each cluster that captures the key theme or development. Return ONLY a JSON array of strings, one label per cluster.

Clusters:
${clusterSummaries.join("\n")}

Return format: ["label1", "label2", ...]`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const labels: string[] = JSON.parse(jsonMatch[0]);
      return clusters.map((c, i) => ({
        ...c,
        label: labels[i] || c.label,
      }));
    }
  } catch (err) {
    console.warn("Cluster label refinement failed, using defaults:", err);
  }

  return clusters;
}

// ─── AI: Extract top numbers ───────────────────────────────────────────────

async function extractTopNumbers(
  clusters: WeeklyThemeCluster[]
): Promise<{ value: string; unit: string; context: string; source_article_id: string; delta?: string }[]> {
  // Collect all key numbers with article IDs
  const allNumbers: { value: string; unit: string; context: string; articleId: string; articleTitle: string }[] = [];
  for (const cluster of clusters) {
    for (let i = 0; i < cluster.articles.length; i++) {
      const article = cluster.articles[i];
      if (cluster.key_numbers[i]) {
        allNumbers.push({
          ...cluster.key_numbers[i],
          articleId: article.id,
          articleTitle: article.title,
        });
      }
    }
    // Also add any remaining key_numbers not matched 1:1 with articles
    for (let i = cluster.articles.length; i < cluster.key_numbers.length; i++) {
      allNumbers.push({
        ...cluster.key_numbers[i],
        articleId: cluster.articles[0]?.id || "",
        articleTitle: cluster.articles[0]?.title || "",
      });
    }
  }

  if (allNumbers.length === 0) return [];

  // Return top 5 by appearance (no AI call needed for simple extraction)
  return allNumbers.slice(0, 5).map((n) => ({
    value: n.value,
    unit: n.unit,
    context: n.context,
    source_article_id: n.articleId,
  }));
}

// ─── Fetch storyline + transmission data ───────────────────────────────────

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

// ─── Aggregate domain-level sentiment ──────────────────────────────────────

function buildSentimentSummary(clusters: WeeklyThemeCluster[]) {
  const byDomain: Record<string, Record<string, number>> = {};
  let totalPositive = 0;
  let totalNegative = 0;
  let totalNeutral = 0;

  for (const cluster of clusters) {
    const domain = cluster.domain;
    if (!byDomain[domain]) {
      byDomain[domain] = { positive: 0, negative: 0, neutral: 0, mixed: 0 };
    }
    byDomain[domain].positive += cluster.sentiment_agg.positive;
    byDomain[domain].negative += cluster.sentiment_agg.negative;
    byDomain[domain].neutral += cluster.sentiment_agg.neutral;
    byDomain[domain].mixed += cluster.sentiment_agg.mixed;

    totalPositive += cluster.sentiment_agg.positive;
    totalNegative += cluster.sentiment_agg.negative;
    totalNeutral += cluster.sentiment_agg.neutral;
  }

  const overall =
    totalPositive > totalNegative * 1.5
      ? "positive"
      : totalNegative > totalPositive * 1.5
        ? "negative"
        : "mixed";

  return { overall, by_domain: byDomain };
}

// ─── POST handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
    if (!isCron) {
      const auth = await requireAuth("admin");
      if ("error" in auth) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
      }
    }

    const weekStartParam = req.nextUrl.searchParams.get("weekStart");
    const { weekStart, weekEnd } = weekStartParam
      ? { weekStart: weekStartParam, weekEnd: (() => {
          const d = new Date(weekStartParam + "T00:00:00");
          d.setDate(d.getDate() + 6);
          return d.toISOString().slice(0, 10);
        })() }
      : getDefaultWeekRange();

    console.log(`Weekly report: generating for ${weekStart} to ${weekEnd}`);

    // Step 1: Fetch & cluster articles
    const articles = await fetchWeekArticles(weekStart, weekEnd);
    if (articles.length === 0) {
      return NextResponse.json(
        { error: "No enriched articles found for this week", weekStart, weekEnd },
        { status: 404 }
      );
    }

    let clusters = clusterArticles(articles);
    console.log(`Weekly report: ${articles.length} articles in ${clusters.length} clusters`);

    // Step 2: Refine cluster labels with AI
    clusters = await refineClusterLabels(clusters);

    // Step 3: Extract top numbers
    const topNumbers = await extractTopNumbers(clusters);

    // Step 4: Fetch storyline and transmission data
    const [storylineUpdates, transmissionActivity] = await Promise.all([
      fetchStorylineUpdates(weekStart, weekEnd),
      fetchTransmissionActivity(weekStart, weekEnd),
    ]);

    // Step 5: Build sentiment summary
    const sentimentSummary = buildSentimentSummary(clusters);

    // Step 6: Assemble and persist report
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
        generated_at = NOW()
      RETURNING *`,
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

    console.log(`Weekly report ${reportId}: saved with ${clusters.length} clusters, ${topNumbers.length} numbers`);

    // Embed weekly report into RAG corpus (own editorial, feedback loop)
    try {
      const { embedWeeklyReport } = await import("@/lib/intelligence/embedder");
      await embedWeeklyReport(reportId);
    } catch (embedErr) {
      console.warn("Failed to embed weekly report:", embedErr);
    }

    return NextResponse.json({
      id: reportId,
      weekStart,
      weekEnd,
      clusters: clusters.length,
      articles: articles.length,
      topNumbers: topNumbers.length,
      storylines: storylineUpdates.length,
      status: "ready",
    });
  } catch (err) {
    console.error("Weekly report generation:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// GET returns the most recent report
export async function GET() {
  const auth = await requireAuth();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { rows } = await pool.query(
      "SELECT * FROM weekly_reports ORDER BY week_start DESC LIMIT 1"
    );
    if (rows.length === 0) {
      return NextResponse.json({ report: null });
    }
    return NextResponse.json({ report: rows[0] });
  } catch (err) {
    console.error("Weekly report fetch:", err);
    return NextResponse.json({ report: null });
  }
}
