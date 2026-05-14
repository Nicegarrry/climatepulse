import { NextResponse, type NextRequest } from "next/server";
import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";
import { GEMINI_MODEL } from "@/lib/ai-models";
import { SOURCE_FACTOR_BY_ID } from "@/lib/automacc/factors";
import { leversForApproachAndSource } from "@/lib/automacc/levers";
import {
  flatNpv,
  costPerTco2,
  roundTo,
  DEFAULT_HURDLE_RATE,
  DEFAULT_HORIZON_YEARS,
} from "@/lib/automacc/v4-math";
import type {
  CompanyMeta,
  LeverChoice,
  LeverRef,
  SourceEntry,
} from "@/lib/automacc/v4-types";

// AutoMACC v4 — Gemini Call 2. Refines lever capex + computes annual opex
// delta (positive = annual saving), then server-side deterministic NPV +
// $/tCO2 for the MACC chart on Screen 3.
export const runtime = "nodejs";
export const maxDuration = 60;

interface MaccRequest {
  meta: CompanyMeta;
  sources: SourceEntry[];
  levers: LeverChoice[];
}

interface GeminiLeverRow {
  source_id: string;
  refined_capex_aud: number;
  lifetime_opex_delta_aud_annual: number;
  rationale: string;
  library_lever_id: string | null;
}

interface MaccLeverRow {
  source_id: string;
  refined_capex_aud: number;
  lifetime_opex_delta_aud_annual: number;
  abatement_tco2y_final: number;
  npv_aud: number;
  cost_per_tco2: number;
  rationale: string;
  library_lever_id: string | null;
}

interface MaccResponse {
  levers: MaccLeverRow[];
}

const RESPONSE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    levers: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          source_id: { type: SchemaType.STRING },
          refined_capex_aud: { type: SchemaType.NUMBER },
          lifetime_opex_delta_aud_annual: { type: SchemaType.NUMBER },
          rationale: { type: SchemaType.STRING },
          library_lever_id: { type: SchemaType.STRING, nullable: true },
        },
        required: ["source_id", "refined_capex_aud", "lifetime_opex_delta_aud_annual", "rationale"],
      },
    },
  },
  required: ["levers"],
};

function validateBody(body: unknown): MaccRequest | { error: string } {
  if (!body || typeof body !== "object") return { error: "body must be an object" };
  const b = body as Record<string, unknown>;
  if (!b.meta || typeof b.meta !== "object") return { error: "meta required" };
  if (!Array.isArray(b.sources)) return { error: "sources must be an array" };
  if (!Array.isArray(b.levers)) return { error: "levers must be an array" };
  if (b.levers.length === 0) return { error: "levers must not be empty" };
  if (b.levers.length > 60) return { error: "levers exceeds 60 (limit)" };
  for (const l of b.levers as LeverChoice[]) {
    if (!l || typeof l !== "object") return { error: "lever entries must be objects" };
    if (!l.sourceId || typeof l.sourceId !== "string") return { error: "lever.sourceId required" };
    if (!l.approach) return { error: `lever for source ${l.sourceId} missing approach` };
  }
  return b as unknown as MaccRequest;
}

function fmtCapex(t: LeverRef["typicalCapex"]): string {
  return `${t.low.toLocaleString()}/${t.mid.toLocaleString()}/${t.high.toLocaleString()} ${t.unit}`;
}

function buildPrompt(req: MaccRequest): string {
  const m = req.meta;
  const metaLine = [
    `Industry: ${m.industry || "unspecified"}`,
    `Employees: ${m.employees || "unspecified"}`,
    `Revenue: ${m.revenue || "unspecified"}`,
    `Buildings: ${m.buildings || 0}`,
    m.description ? `Description: ${m.description}` : "",
  ].filter(Boolean).join(" | ");

  const sourceById = new Map<string, SourceEntry>(req.sources.map((s) => [s.id, s]));
  const rows: string[] = [];
  for (const choice of req.levers) {
    const entry = sourceById.get(choice.sourceId);
    if (!entry) continue;
    const factor = SOURCE_FACTOR_BY_ID[entry.sourceId];
    if (!factor || !choice.approach) continue;
    const refs = leversForApproachAndSource(choice.approach, entry.sourceId).slice(0, 2);
    const refsLine = refs.length
      ? refs.map((r) => `[${r.id}] ${r.name}: typicalCapex=${fmtCapex(r.typicalCapex)} | opexDeltaPctOfCapex=${r.opexDeltaPctOfCapex}% | abatementEfficiencyPct=${r.abatementEfficiencyPct}% | lifetimeYears=${r.lifetimeYears} | evidence=${r.evidenceSource}`).join(" ;; ")
      : "(no library match — use student guess as primary signal)";
    const costFactor = factor.costFactorAudPerUnit ?? 0;
    const numerical = entry.numericalValue ?? 0;
    const annualAvoidedCost = numerical * (choice.abatementPct / 100) * costFactor;
    rows.push(`- source_id=${choice.sourceId} | factor=${factor.id} (${factor.label}) | numerical=${numerical} ${factor.numerical.unit} | tco2y=${entry.tco2y ?? 0} | approach=${choice.approach} | student_capex_aud=${choice.capexAud ?? "blank"} | abatement_pct=${choice.abatementPct} | student_desc="${(choice.description || "").slice(0, 200)}" | annual_avoided_fuel_cost_hint=${Math.round(annualAvoidedCost)} AUD/y | refs: ${refsLine}`);
  }

  return [
    `You are refining capex and annual opex deltas for marginal-abatement levers chosen by an Australian company.`,
    ``,
    `COMPANY: ${metaLine}`,
    ``,
    `RULES:`,
    `- One row per source_id, returning source_id EXACTLY as given.`,
    `- refined_capex_aud: if student_capex is within ~50% of typical mid (scaled by numerical × ref unit), keep it; otherwise nudge toward typical mid. All-in AUD, not per-unit.`,
    `- lifetime_opex_delta_aud_annual: positive = annual saving, negative = annual cost. Compute as: (a) annual_avoided_fuel_cost_hint (already positive when there's a saving) PLUS (b) -1 × (ref opexDeltaPctOfCapex × refined_capex_aud / 100). Note (b) flips the sign of the ref pct: ref opexDeltaPctOfCapex is "negative = saving" so multiplying by -1 converts to our "positive = saving" total.`,
    `- library_lever_id: cite closest ref id if matching, else null.`,
    `- rationale: ONE concise sentence (no em dashes, no hedging) covering capex + opex logic.`,
    `- JSON only.`,
    ``,
    `LEVERS:`,
    rows.join("\n"),
  ].join("\n");
}

async function callGemini(prompt: string): Promise<GeminiLeverRow[] | null> {
  if (!process.env.GOOGLE_AI_API_KEY) {
    console.warn("[automacc/macc] GOOGLE_AI_API_KEY missing");
    return null;
  }
  try {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.2,
        maxOutputTokens: 2000,
      },
    });
    const result = await model.generateContent(prompt);
    const parsed = JSON.parse(result.response.text()) as { levers?: unknown };
    if (!Array.isArray(parsed.levers)) return null;
    const rows: GeminiLeverRow[] = [];
    for (const raw of parsed.levers) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as Record<string, unknown>;
      if (typeof r.source_id !== "string") continue;
      if (typeof r.refined_capex_aud !== "number" || !Number.isFinite(r.refined_capex_aud)) continue;
      if (typeof r.lifetime_opex_delta_aud_annual !== "number" || !Number.isFinite(r.lifetime_opex_delta_aud_annual)) continue;
      const libId = r.library_lever_id;
      rows.push({
        source_id: r.source_id,
        refined_capex_aud: r.refined_capex_aud,
        lifetime_opex_delta_aud_annual: r.lifetime_opex_delta_aud_annual,
        rationale: typeof r.rationale === "string" ? r.rationale : "",
        library_lever_id: typeof libId === "string" && libId.length > 0 ? libId : null,
      });
    }
    return rows;
  } catch (err) {
    console.error("[automacc/macc] gemini failed:", err);
    return null;
  }
}

function compute(geminiRows: GeminiLeverRow[], req: MaccRequest): MaccLeverRow[] {
  const sourceById = new Map<string, SourceEntry>(req.sources.map((s) => [s.id, s]));
  const choiceById = new Map<string, LeverChoice>(req.levers.map((l) => [l.sourceId, l]));
  const seen = new Set<string>();
  const out: MaccLeverRow[] = [];

  for (const row of geminiRows) {
    if (seen.has(row.source_id)) continue;
    const entry = sourceById.get(row.source_id);
    const choice = choiceById.get(row.source_id);
    if (!entry || !choice) {
      console.warn(`[automacc/macc] gemini returned unknown source_id=${row.source_id}`);
      continue;
    }
    seen.add(row.source_id);

    const capex = Math.max(0, row.refined_capex_aud);
    const opex = row.lifetime_opex_delta_aud_annual;
    const abatementTco2yFinal = (entry.tco2y ?? 0) * (choice.abatementPct / 100);
    const npv = flatNpv(capex, opex, DEFAULT_HURDLE_RATE, DEFAULT_HORIZON_YEARS);
    const cpt = costPerTco2(npv, abatementTco2yFinal, DEFAULT_HORIZON_YEARS);

    out.push({
      source_id: row.source_id,
      refined_capex_aud: roundTo(capex, 10),
      lifetime_opex_delta_aud_annual: roundTo(opex, 10),
      abatement_tco2y_final: Math.round(abatementTco2yFinal * 10) / 10,
      npv_aud: roundTo(npv, 10),
      cost_per_tco2: Math.round(cpt),
      rationale: row.rationale.trim(),
      library_lever_id: row.library_lever_id,
    });
  }

  const missing = req.levers.filter((l) => !seen.has(l.sourceId));
  if (missing.length > 0) {
    console.warn(
      `[automacc/macc] gemini omitted ${missing.length} lever(s): ${missing.map((m) => m.sourceId).join(",")}`,
    );
  }

  return out;
}

export async function POST(req: NextRequest): Promise<NextResponse<MaccResponse | { error: string }>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const validated = validateBody(body);
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  const prompt = buildPrompt(validated);
  const geminiRows = await callGemini(prompt);
  if (!geminiRows) {
    return NextResponse.json({ error: "macc refinement failed" }, { status: 500 });
  }
  const levers = compute(geminiRows, validated);
  return NextResponse.json({ levers }, { status: 200 });
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: true, route: "automacc/macc" });
}
