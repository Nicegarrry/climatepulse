import { NextRequest, NextResponse } from "next/server";
import { retrieveContent } from "@/lib/intelligence/retriever";
import { generateAnswer } from "@/lib/intelligence/generator";
import type { RetrievalFilters } from "@/lib/intelligence/retriever";
import type { ContentType } from "@/lib/intelligence/embedder";
import type { SignalType, Sentiment } from "@/lib/types";
import { requireAuth } from "@/lib/supabase/server";
import { rateLimitOr429 } from "@/lib/surfaces/rate-limit";

export async function POST(req: NextRequest) {
  // Gate: this fires paid embedding + Claude Sonnet (mode:"research") / Gemini
  // calls. Login-only + per-user throttle so it can't be scripted for AI spend.
  const auth = await requireAuth();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const limited = rateLimitOr429({ surfaceId: "intelligence-query", key: auth.user.id, limit: 20, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const body = await req.json();
    const {
      query,
      filters = {},
      mode = "brief",
      limit = 15,
    } = body as {
      query: string;
      filters?: {
        content_types?: ContentType[];
        trustworthiness_tiers?: number[];
        domains?: string[];
        signal_types?: SignalType[];
        sentiments?: Sentiment[];
        entity_ids?: number[];
        min_significance?: number;
        date_from?: string;
        date_to?: string;
        jurisdictions?: string[];
      };
      mode?: "research" | "brief";
      limit?: number;
    };

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    const retrievalFilters: RetrievalFilters = {
      content_types: filters.content_types,
      trustworthiness_tiers: filters.trustworthiness_tiers,
      domains: filters.domains,
      signal_types: filters.signal_types,
      sentiments: filters.sentiments,
      entity_ids: filters.entity_ids,
      min_significance: filters.min_significance,
      date_from: filters.date_from,
      date_to: filters.date_to,
      jurisdictions: filters.jurisdictions,
    };

    const items = await retrieveContent(query, retrievalFilters, {
      limit: Math.min(limit, 30),
      significanceBoost: mode === "research" ? 0.25 : 0.15,
      recencyBoost: 0.1,
      trustBoost: 0.1,
      dedupeBySource: true,
    });

    if (items.length === 0) {
      return NextResponse.json({
        answer:
          "No relevant content found matching your query and filters. Try broadening your search, removing filters, or adjusting the date range.",
        sources: [],
        model_used: "none",
      });
    }

    const response = await generateAnswer(query, items, mode);
    return NextResponse.json(response);
  } catch (err) {
    console.error("Intelligence query error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Query failed" },
      { status: 500 }
    );
  }
}
