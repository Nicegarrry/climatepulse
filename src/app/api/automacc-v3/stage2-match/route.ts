import { NextRequest, NextResponse } from "next/server";
import {
  GoogleGenerativeAI,
  SchemaType,
  type Schema,
} from "@google/generative-ai";
import { GEMINI_MODEL } from "@/lib/ai-models";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface MatchLever {
  lever_id: string;
  name: string;
  typical_abatement_pct: number;
  applicable_to: { source: string; end_use: string | null }[];
}

interface MatchRow {
  row_id: string;
  label: string;
  source: string;
  end_use: string | null;
  tco2e_estimate: number;
}

interface MatchRequest {
  org_name: string;
  org_sector: string;
  levers: MatchLever[];
  rows: MatchRow[];
}

interface MatchResponse {
  rationales: Record<string, string>;
}

function makeSchema(levers: MatchLever[]): Schema {
  const properties: Record<string, Schema> = {};
  for (const l of levers) {
    properties[l.lever_id] = { type: SchemaType.STRING };
  }
  return {
    type: SchemaType.OBJECT,
    properties: {
      rationales: {
        type: SchemaType.OBJECT,
        properties,
      },
    },
    required: ["rationales"],
  };
}

function buildPrompt(req: MatchRequest): string {
  const rowLines = req.rows
    .map(r => `  ${r.row_id}: ${r.label} — ${r.tco2e_estimate} tCO₂e/yr`)
    .join("\n");

  const leverLines = req.levers
    .map(l => {
      const targets = l.applicable_to
        .map(a => `${a.source}${a.end_use ? `/${a.end_use}` : ""}`)
        .join(", ");
      return `  ${l.lever_id}: ${l.name} (~${l.typical_abatement_pct}% abatement; targets: ${targets})`;
    })
    .join("\n");

  return [
    `You are writing one-line match rationales explaining why each abatement lever applies to an organisation's baseline.`,
    ``,
    `ORGANISATION: ${req.org_name} — sector: ${req.org_sector} — region: Australia`,
    ``,
    `BASELINE SOURCE ROWS:`,
    rowLines,
    ``,
    `MATCHED LEVERS (already pre-filtered to this org's sources):`,
    leverLines,
    ``,
    `For each lever write 1–2 tight sentences explaining the mechanism and why it fits this sector/source combination.`,
    `Rules: no hedging, no em dashes, no filler. Sentence 1: mechanism. Sentence 2 (optional): one quantitative anchor or AU-specific note.`,
    ``,
    `Return JSON: { "rationales": { "<lever_id>": "<rationale>", ... } } — one key per lever listed above.`,
  ].join("\n");
}

async function callGemini(req: MatchRequest): Promise<MatchResponse | null> {
  if (!process.env.GOOGLE_AI_API_KEY) return null;
  const timeoutMs = 8000;
  try {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: makeSchema(req.levers),
        temperature: 0.3,
        maxOutputTokens: Math.min(req.levers.length * 80, 2000),
      },
    });
    const prompt = buildPrompt(req);
    const resPromise = model.generateContent(prompt);
    const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), timeoutMs));
    const raced = await Promise.race([resPromise, timeout]);
    if (!raced) {
      console.warn("[stage2-match] gemini timed out");
      return null;
    }
    const parsed = JSON.parse(raced.response.text()) as { rationales?: unknown };
    if (!parsed.rationales || typeof parsed.rationales !== "object") return null;
    const rationales: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed.rationales)) {
      if (typeof v === "string" && v.trim()) rationales[k] = v.trim();
    }
    return { rationales };
  } catch (err) {
    console.warn("[stage2-match] gemini failed:", err);
    return null;
  }
}

function validateRequest(body: unknown): MatchRequest | { error: string } {
  if (!body || typeof body !== "object") return { error: "body must be an object" };
  const b = body as Record<string, unknown>;
  if (typeof b.org_name !== "string" || !b.org_name) return { error: "org_name required" };
  if (typeof b.org_sector !== "string" || !b.org_sector) return { error: "org_sector required" };
  if (!Array.isArray(b.levers) || b.levers.length === 0) return { error: "levers (non-empty array) required" };
  if (!Array.isArray(b.rows) || b.rows.length === 0) return { error: "rows (non-empty array) required" };
  return b as unknown as MatchRequest;
}

export async function POST(
  req: NextRequest,
): Promise<NextResponse<MatchResponse | { error: string }>> {
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

  const result = await callGemini(validated);
  return NextResponse.json(result ?? { rationales: {} });
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: true, route: "automacc-v3/stage2-match" });
}
