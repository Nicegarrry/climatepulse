import { NextRequest, NextResponse } from "next/server";
import { routeAndRetrieve } from "@/lib/intelligence/router";
import type { RoutingDecision } from "@/lib/intelligence/router";

/**
 * Learn-specific retrieval endpoint with conditional routing.
 *
 * Routes per-query between graph-walk and vector backends based on
 * multi-hop intent + resolved entity count. See
 * `src/lib/intelligence/router.ts` and the rationale in
 * `docs/graph-rag-spike/04-recommendation.md`.
 *
 * Returns the retrieved items PLUS the classification + which backend
 * fired, so the Learn UI can show a debug indicator and we can mine
 * usage logs to refine the routing heuristic.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      query,
      limit = 10,
      forceBackend,
      maxHops,
      minConfidence,
    } = body as {
      query: string;
      limit?: number;
      forceBackend?: RoutingDecision;
      maxHops?: 1 | 2 | 3;
      minConfidence?: number;
    };

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    const result = await routeAndRetrieve(query, {
      limit: Math.min(limit, 30),
      forceBackend,
      maxHops,
      minConfidence,
    });

    return NextResponse.json({
      items: result.items,
      backend_used: result.backendUsed,
      classification: {
        decision: result.classification.decision,
        reason: result.classification.reason,
        multi_hop_matched: result.classification.multiHopMatched,
        multi_hop_patterns: result.classification.multiHopPatterns,
        candidate_entity_phrases: result.classification.candidateEntityPhrases,
        resolved_entity_ids: result.classification.resolvedEntityIds,
        resolved_entity_names: result.classification.resolvedEntityNames,
      },
      latency_ms: result.latencyMs,
    });
  } catch (err) {
    console.error("Learn query error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Query failed" },
      { status: 500 }
    );
  }
}
