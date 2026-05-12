import { NextRequest, NextResponse } from "next/server";
import {
  GoogleGenerativeAI,
  SchemaType,
  type Schema,
} from "@google/generative-ai";
import { createHash } from "node:crypto";
import { GEMINI_MODEL } from "@/lib/ai-models";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface SourceRowContext {
  row_id: string;
  source: string;
  end_use: string | null;
  tco2e_estimate: number;
}

interface LeverContext {
  lever_id: string;
  lever_name?: string;
  typical_abatement_pct?: number;
  payback_years?: number;
  capex_band_aud?: string;
  category?: string;
  description?: string;
}

interface OrgContext {
  org_name?: string;
  sector?: string;
  region?: string;
}

interface RationaleRequest {
  run_id: string;
  lever: LeverContext;
  source_row: SourceRowContext;
  org_context?: OrgContext;
}

interface RationaleResponse {
  rationale: string;
  cache_hit: boolean;
  cache_key: string;
  run_id: string;
}

const RATIONALE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    rationale: { type: SchemaType.STRING },
  },
  required: ["rationale"],
};

type CacheEntry = { rationale: string; createdAt: number };

const RUN_CACHE: Map<string, Map<string, CacheEntry>> = new Map();
const RUN_TTL_MS = 60 * 60 * 1000;
const CACHE_PER_RUN_CAP = 500;

function sourceRowSignature(row: SourceRowContext): string {
  const canonical = JSON.stringify({
    row_id: row.row_id,
    source: row.source,
    end_use: row.end_use ?? null,
    tco2e_estimate: Math.round((row.tco2e_estimate ?? 0) * 100) / 100,
  });
  return createHash("sha1").update(canonical).digest("hex").slice(0, 12);
}

function cacheKey(leverId: string, rowSig: string): string {
  return `${leverId}::${rowSig}`;
}

function pruneExpiredRuns(now: number): void {
  for (const [runId, runMap] of RUN_CACHE) {
    if (!runMap.size) {
      RUN_CACHE.delete(runId);
      continue;
    }
    let newest = 0;
    for (const v of runMap.values()) {
      if (v.createdAt > newest) newest = v.createdAt;
    }
    if (now - newest > RUN_TTL_MS) RUN_CACHE.delete(runId);
  }
}

function buildPrompt(req: RationaleRequest): string {
  const { lever, source_row, org_context } = req;
  const sectorLine = org_context?.sector
    ? `${org_context.sector}${org_context.org_name ? ` (${org_context.org_name})` : ""}`
    : "an unspecified-sector organisation";
  const regionLine = org_context?.region ?? "Australia";

  return [
    `You are writing a one-paragraph rationale to explain why a decarbonisation lever applies to a specific baseline emissions row.`,
    `The reader is hovering on a lever card in an AutoMACC tool. They need a concise, evidence-grounded explanation in 2-4 sentences.`,
    ``,
    `LEVER`,
    `- id: ${lever.lever_id}`,
    `- name: ${lever.lever_name ?? "(unnamed)"}`,
    `- category: ${lever.category ?? "(unspecified)"}`,
    `- typical_abatement_pct: ${lever.typical_abatement_pct ?? "(unknown)"}`,
    `- payback_years: ${lever.payback_years ?? "(unknown)"}`,
    `- capex_band_aud: ${lever.capex_band_aud ?? "(unknown)"}`,
    `- description: ${lever.description ?? "(no description)"}`,
    ``,
    `BASELINE SOURCE ROW`,
    `- row_id: ${source_row.row_id}`,
    `- source: ${source_row.source}`,
    `- end_use: ${source_row.end_use ?? "(aggregate)"}`,
    `- tco2e (horizon): ${source_row.tco2e_estimate}`,
    ``,
    `ORG CONTEXT`,
    `- ${sectorLine} in ${regionLine}.`,
    ``,
    `HARD RULES`,
    `- 2-4 sentences. 50-90 words.`,
    `- Sentence 1: name the mechanism that links the lever to this source/end-use.`,
    `- Sentence 2: one quantitative anchor (typical abatement, payback, capex band) translated to this row's scale.`,
    `- Optional sentence 3: one watch-out or precondition specific to ${regionLine}.`,
    `- No hedging. No filler. No bullet points. No em dashes. No "Furthermore", "Moreover", "It is important to note".`,
    `- Do not invent numbers absent from the inputs.`,
    ``,
    `Return JSON: { "rationale": "<paragraph>" }`,
  ].join("\n");
}

function fallbackRationale(req: RationaleRequest): string {
  const { lever, source_row } = req;
  const name = lever.lever_name ?? lever.lever_id;
  const pct = lever.typical_abatement_pct;
  const horizon = source_row.tco2e_estimate;
  const claim =
    typeof pct === "number" && typeof horizon === "number"
      ? `Typical abatement of ${pct}% applied to ${horizon} tCO2e on this row implies roughly ${Math.round(pct * horizon) / 100} tCO2e of in-scope reduction.`
      : `Sized from baseline volume and the lever's published abatement band.`;
  return `${name} applies to ${source_row.source}${source_row.end_use ? ` / ${source_row.end_use}` : ""} because the lever's mechanism targets the same end-use. ${claim} Confirm site-specific applicability before relying on the headline number.`;
}

async function callGemini(prompt: string, startedAt: number): Promise<string | null> {
  if (!process.env.GOOGLE_AI_API_KEY) return null;
  const timeoutMs = 4000;
  try {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: RATIONALE_SCHEMA,
        temperature: 0.4,
        maxOutputTokens: 400,
      },
    });

    const resPromise = model.generateContent(prompt);
    const timeout = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), timeoutMs),
    );
    const raced = await Promise.race([resPromise, timeout]);
    if (!raced) {
      console.warn(`[lever-rationale] gemini timed out after ${Date.now() - startedAt}ms`);
      return null;
    }
    const text = raced.response.text();
    const parsed = JSON.parse(text) as { rationale?: string };
    const out = parsed.rationale?.trim();
    return out && out.length > 0 ? out : null;
  } catch (err) {
    console.warn("[lever-rationale] gemini failed:", err);
    return null;
  }
}

function validateRequest(body: unknown): RationaleRequest | { error: string } {
  if (!body || typeof body !== "object") return { error: "body must be an object" };
  const b = body as Record<string, unknown>;
  if (typeof b.run_id !== "string" || !b.run_id) return { error: "run_id (string) required" };
  if (!b.lever || typeof b.lever !== "object") return { error: "lever (object) required" };
  const lever = b.lever as Record<string, unknown>;
  if (typeof lever.lever_id !== "string" || !lever.lever_id) {
    return { error: "lever.lever_id (string) required" };
  }
  if (!b.source_row || typeof b.source_row !== "object") {
    return { error: "source_row (object) required" };
  }
  const row = b.source_row as Record<string, unknown>;
  if (typeof row.row_id !== "string" || !row.row_id) {
    return { error: "source_row.row_id (string) required" };
  }
  if (typeof row.source !== "string" || !row.source) {
    return { error: "source_row.source (string) required" };
  }
  if (typeof row.tco2e_estimate !== "number") {
    return { error: "source_row.tco2e_estimate (number) required" };
  }
  return b as unknown as RationaleRequest;
}

export async function POST(req: NextRequest): Promise<NextResponse<RationaleResponse | { error: string }>> {
  const startedAt = Date.now();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const validated = validateRequest(body);
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const { run_id, lever, source_row } = validated;
  const rowSig = sourceRowSignature(source_row);
  const key = cacheKey(lever.lever_id, rowSig);

  pruneExpiredRuns(startedAt);

  let runMap = RUN_CACHE.get(run_id);
  if (runMap) {
    const cached = runMap.get(key);
    if (cached) {
      return NextResponse.json({
        rationale: cached.rationale,
        cache_hit: true,
        cache_key: key,
        run_id,
      });
    }
  }

  const prompt = buildPrompt(validated);
  const llmText = await callGemini(prompt, startedAt);
  const rationale = llmText ?? fallbackRationale(validated);

  if (!runMap) {
    runMap = new Map();
    RUN_CACHE.set(run_id, runMap);
  }
  if (runMap.size >= CACHE_PER_RUN_CAP) {
    const firstKey = runMap.keys().next().value as string | undefined;
    if (firstKey) runMap.delete(firstKey);
  }
  runMap.set(key, { rationale, createdAt: startedAt });

  return NextResponse.json({
    rationale,
    cache_hit: false,
    cache_key: key,
    run_id,
  });
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    ok: true,
    route: "automacc-v3/lever-rationale",
    method: "POST",
    runs_cached: RUN_CACHE.size,
  });
}
