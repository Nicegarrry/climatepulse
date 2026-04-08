import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import pool from "@/lib/db";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");

/**
 * POST /api/channels/suggest
 * Analyzes recent enriched articles to suggest new transmission channels
 * based on domain co-occurrence patterns.
 */
export async function POST() {
  try {
    // Step 1: Find domain pairs that co-occur in articles but don't have existing channels
    const { rows: coOccurrences } = await pool.query(`
      WITH domain_pairs AS (
        SELECT
          ea.primary_domain AS source_domain,
          ea.secondary_domain AS target_domain,
          COUNT(*) AS co_occurrence_count,
          AVG(ea.significance_composite) AS avg_significance,
          ARRAY_AGG(DISTINCT ra.title ORDER BY ra.title) FILTER (WHERE ra.title IS NOT NULL) AS sample_titles
        FROM enriched_articles ea
        JOIN raw_articles ra ON ra.id = ea.raw_article_id
        WHERE ea.primary_domain IS NOT NULL
          AND ea.secondary_domain IS NOT NULL
          AND ea.primary_domain != ea.secondary_domain
          AND ea.enriched_at > NOW() - INTERVAL '30 days'
        GROUP BY ea.primary_domain, ea.secondary_domain
        HAVING COUNT(*) >= 3
      )
      SELECT
        dp.*,
        sd.id AS source_domain_id,
        sd.name AS source_domain_name,
        td.id AS target_domain_id,
        td.name AS target_domain_name
      FROM domain_pairs dp
      JOIN taxonomy_domains sd ON sd.slug = dp.source_domain
      JOIN taxonomy_domains td ON td.slug = dp.target_domain
      WHERE NOT EXISTS (
        SELECT 1 FROM transmission_channels tc
        WHERE tc.source_domain_id = sd.id AND tc.target_domain_id = td.id AND tc.is_active = true
      )
      ORDER BY dp.co_occurrence_count DESC
      LIMIT 10
    `);

    if (coOccurrences.length === 0) {
      return NextResponse.json({
        suggestions: [],
        message: "No new channel patterns found — existing channels cover all observed domain pairs.",
      });
    }

    // Step 2: Use Gemini to generate channel suggestions from the co-occurrence data
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const pairsContext = coOccurrences.map((row) => {
      const titles = (row.sample_titles as string[]).slice(0, 5).join("; ");
      return `- ${row.source_domain_name} → ${row.target_domain_name} (${row.co_occurrence_count} co-occurrences, avg significance: ${Math.round(row.avg_significance)})\n  Sample articles: ${titles}`;
    }).join("\n");

    const prompt = `You are an expert in climate and energy policy. Analyze these domain co-occurrence patterns from recent news articles and suggest transmission channels (causal relationships between domains).

For each domain pair, propose a channel with:
- "label": A concise description of the causal link (e.g., "Renewable intermittency drives storage investment")
- "description": 1-2 sentences explaining the relationship
- "mechanism": The causal chain (e.g., "A → B → C → D")
- "strength": "weak", "moderate", or "strong"

Only suggest channels where there is a genuine causal or influence relationship, not just topical overlap. Skip pairs where the connection is trivial or coincidental.

Domain pairs observed:
${pairsContext}

Respond in JSON only: { "suggestions": [{ "source_domain": "...", "target_domain": "...", "label": "...", "description": "...", "mechanism": "...", "strength": "..." }] }`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    let cleaned = text.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(cleaned);
    const suggestions = (parsed.suggestions || []).map((s: {
      source_domain: string;
      target_domain: string;
      label: string;
      description: string;
      mechanism: string;
      strength: string;
    }) => {
      const sourceRow = coOccurrences.find(
        (r) => r.source_domain_name === s.source_domain || r.source_domain === s.source_domain
      );
      const targetRow = coOccurrences.find(
        (r) => r.target_domain_name === s.target_domain || r.target_domain === s.target_domain
      );
      return {
        ...s,
        source_domain_id: sourceRow?.source_domain_id ?? null,
        target_domain_id: targetRow?.target_domain_id ?? (sourceRow?.target_domain_id ?? null),
      };
    });

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("Error suggesting channels:", error);
    return NextResponse.json(
      { error: "Failed to suggest channels" },
      { status: 500 }
    );
  }
}
