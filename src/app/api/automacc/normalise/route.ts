import { NextResponse, type NextRequest } from "next/server";
import {
  GoogleGenerativeAI,
  SchemaType,
  type Schema,
} from "@google/generative-ai";
import { GEMINI_MODEL } from "@/lib/ai-models";
import { SOURCE_FACTOR_BY_ID, STATE_GRID_INTENSITY } from "@/lib/automacc/factors";
import type {
  CompanyMeta,
  SourceEntry,
  SourceFactor,
} from "@/lib/automacc/v4-types";

// AutoMACC v4 — Gemini Call 1. Translates vague student source entries into
// deterministic tCO2/y. Gemini supplies numerical_value + rationale only;
// server multiplies by curated factor. Factor table is the truth.
export const runtime = "nodejs";
export const maxDuration = 60;

interface NormaliseRequest {
  meta: CompanyMeta;
  sources: SourceEntry[];
}

interface GeminiRow {
  source_id: string;
  numerical_value: number;
  numerical_unit?: string;
  factor_used?: number;
  confidence: "high" | "medium" | "low";
  rationale: string;
}

interface NormalisedRow {
  source_id: string;
  numerical_value: number;
  numerical_unit: string;
  factor_used: number;
  tco2y: number;
  confidence: "high" | "medium" | "low";
  rationale: string;
}

interface NormaliseResponse {
  normalised: NormalisedRow[];
}

const RESPONSE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    normalised: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          source_id: { type: SchemaType.STRING },
          numerical_value: { type: SchemaType.NUMBER },
          numerical_unit: { type: SchemaType.STRING },
          factor_used: { type: SchemaType.NUMBER },
          confidence: { type: SchemaType.STRING },
          rationale: { type: SchemaType.STRING },
        },
        required: ["source_id", "numerical_value", "confidence", "rationale"],
      },
    },
  },
  required: ["normalised"],
};

function validateBody(body: unknown): NormaliseRequest | { error: string } {
  if (!body || typeof body !== "object") return { error: "body must be an object" };
  const b = body as Record<string, unknown>;
  if (!b.meta || typeof b.meta !== "object") return { error: "meta required" };
  if (!Array.isArray(b.sources)) return { error: "sources must be an array" };
  if (b.sources.length === 0) return { error: "sources must not be empty" };
  if (b.sources.length > 60) return { error: "sources exceeds 60 (limit)" };
  return b as unknown as NormaliseRequest;
}

function buildPrompt(req: NormaliseRequest): string {
  const meta = req.meta;
  const metaLine = [
    `Industry: ${meta.industry || "unspecified"}`,
    `Employees: ${meta.employees || "unspecified"}`,
    `Revenue: ${meta.revenue || "unspecified"}`,
    `Buildings: ${meta.buildings || 0}`,
    meta.description ? `Description: ${meta.description}` : "",
  ]
    .filter(Boolean)
    .join(" | ");

  const rows: string[] = [];
  for (const entry of req.sources) {
    const factor = SOURCE_FACTOR_BY_ID[entry.sourceId];
    if (!factor) {
      // Skip unknown sourceId in the prompt; server will drop the row.
      continue;
    }
    const provided =
      entry.numericalValue === null || entry.numericalValue === undefined
        ? "blank"
        : `${entry.numericalValue} ${factor.numerical.unit}`;
    const note = entry.freeText ? ` | note: "${entry.freeText.slice(0, 200)}"` : "";
    rows.push(
      `- id=${entry.id} | factor=${factor.id} (${factor.label}) | ask="${factor.numerical.name}" in ${factor.numerical.unit} | provided=${provided} | factor_value=${factor.factor.value} ${factor.factor.unitOut}/${factor.numerical.unit} | citation=${factor.factor.source} ${factor.factor.year}${note}`,
    );
  }

  return [
    `You are normalising emission-source inputs for an Australian company building a marginal abatement cost curve. Translate each row into ONE clean numerical value in the unit shown.`,
    ``,
    `COMPANY: ${metaLine}`,
    ``,
    `RULES:`,
    `- If "provided" has a number, use it (sanity check only; trust the student).`,
    `- If "provided" is blank, estimate from company size + the student's note + Australian sector typicals.`,
    `- numerical_value must be in the exact unit shown ("ask"). Echo numerical_unit and factor_used from the row.`,
    `- Output ONE row per input id. source_id MUST equal the input id exactly.`,
    `- rationale: ONE concise sentence explaining the number (e.g. "10 utes × 2,500 L/y typical for a regional consultancy fleet").`,
    `- confidence: "high" if student gave a number, "medium" if estimated from clear size signal, "low" if guessing from thin info.`,
    `- Negative factors (solar offset) are valid; numerical_value should still be positive — sign comes from the factor.`,
    `- No hedging, no filler, no em dashes. JSON only.`,
    ``,
    `SOURCES:`,
    rows.join("\n"),
  ].join("\n");
}

async function callGemini(prompt: string): Promise<GeminiRow[] | null> {
  if (!process.env.GOOGLE_AI_API_KEY) {
    console.warn("[automacc/normalise] GOOGLE_AI_API_KEY missing");
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
        maxOutputTokens: 1500,
      },
    });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = JSON.parse(text) as { normalised?: unknown };
    if (!Array.isArray(parsed.normalised)) return null;
    const rows: GeminiRow[] = [];
    for (const raw of parsed.normalised) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as Record<string, unknown>;
      if (typeof r.source_id !== "string") continue;
      if (typeof r.numerical_value !== "number" || !Number.isFinite(r.numerical_value)) continue;
      const confidenceRaw = typeof r.confidence === "string" ? r.confidence : "medium";
      const confidence: "high" | "medium" | "low" =
        confidenceRaw === "high" || confidenceRaw === "low" ? confidenceRaw : "medium";
      rows.push({
        source_id: r.source_id,
        numerical_value: r.numerical_value,
        numerical_unit: typeof r.numerical_unit === "string" ? r.numerical_unit : undefined,
        factor_used: typeof r.factor_used === "number" ? r.factor_used : undefined,
        confidence,
        rationale: typeof r.rationale === "string" ? r.rationale : "",
      });
    }
    return rows;
  } catch (err) {
    console.error("[automacc/normalise] gemini failed:", err);
    return null;
  }
}

// National-average grid intensity baked into electricity factors. Used as the
// denominator when scaling the data-centre PUE uplift to the chosen state.
const NATIONAL_GRID_INTENSITY = 0.62;

function effectiveFactorValue(
  factor: SourceFactor,
  state: CompanyMeta["state"],
): number {
  if (factor.bucket !== "stationary_electricity") return factor.factor.value;
  if (!state) return factor.factor.value;
  const stateIntensity = STATE_GRID_INTENSITY[state];
  if (stateIntensity === undefined) return factor.factor.value;

  // elec_datacentre: preserve PUE uplift ratio over national average.
  if (factor.id === "elec_datacentre") {
    const pueRatio = factor.factor.value / NATIONAL_GRID_INTENSITY;
    return stateIntensity * pueRatio;
  }
  // elec_onsite_solar_offset: stays negative — offsets displace state grid.
  if (factor.id === "elec_onsite_solar_offset") {
    return -stateIntensity;
  }
  // All other electricity sources: plain override.
  return stateIntensity;
}

function compute(
  geminiRows: GeminiRow[],
  sources: SourceEntry[],
  meta: CompanyMeta,
): NormalisedRow[] {
  const sourceById = new Map<string, SourceEntry>(sources.map((s) => [s.id, s]));
  const seen = new Set<string>();
  const out: NormalisedRow[] = [];

  for (const row of geminiRows) {
    if (seen.has(row.source_id)) continue;
    const entry = sourceById.get(row.source_id);
    if (!entry) {
      console.warn(`[automacc/normalise] gemini returned unknown source_id=${row.source_id}`);
      continue;
    }
    const factor: SourceFactor | undefined = SOURCE_FACTOR_BY_ID[entry.sourceId];
    if (!factor) {
      console.warn(`[automacc/normalise] no factor for sourceId=${entry.sourceId}`);
      continue;
    }
    seen.add(row.source_id);

    // Deterministic server-side math. For electricity sources we override the
    // factor value with the state grid intensity (or PUE-scaled state intensity
    // for data-centre / negative state intensity for on-site solar). All other
    // sources keep the curated factor.value. Sign is preserved either way.
    const factorValue = effectiveFactorValue(factor, meta.state);
    const tco2yRaw = row.numerical_value * factorValue;
    const tco2y = Math.round(tco2yRaw * 10) / 10;

    out.push({
      source_id: row.source_id,
      numerical_value: row.numerical_value,
      numerical_unit: factor.numerical.unit,
      factor_used: factorValue,
      tco2y,
      confidence: row.confidence,
      rationale: row.rationale.trim(),
    });
  }

  // Log any missing rows so we can spot Gemini drop-outs.
  const missing = sources.filter((s) => !seen.has(s.id) && SOURCE_FACTOR_BY_ID[s.sourceId]);
  if (missing.length > 0) {
    console.warn(
      `[automacc/normalise] gemini omitted ${missing.length} row(s): ${missing.map((m) => m.id).join(",")}`,
    );
  }

  return out;
}

export async function POST(
  req: NextRequest,
): Promise<NextResponse<NormaliseResponse | { error: string }>> {
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
    return NextResponse.json({ error: "normalisation failed" }, { status: 500 });
  }

  const normalised = compute(geminiRows, validated.sources, validated.meta);
  return NextResponse.json({ normalised }, { status: 200 });
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: true, route: "automacc/normalise" });
}
