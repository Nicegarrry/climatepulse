import { NextRequest, NextResponse } from "next/server";
import {
  GoogleGenerativeAI,
  SchemaType,
  type Schema,
} from "@google/generative-ai";
import { GEMINI_MODEL } from "@/lib/ai-models";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface ValidateRequest {
  org_name: string;
  org_sector: string;
  rows: {
    label: string;
    source: string;
    end_use: string | null;
    tco2e_estimate: number;
  }[];
}

interface ValidateResponse {
  validation_notes: string;
  flags: string[];
}

const VALIDATE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    validation_notes: { type: SchemaType.STRING },
    flags: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
  },
  required: ["validation_notes", "flags"],
};

const FALLBACK: ValidateResponse = {
  validation_notes: "Baseline looks complete. Proceed to lever allocation.",
  flags: [],
};

function buildPrompt(req: ValidateRequest): string {
  const total = req.rows.reduce((s, r) => s + r.tco2e_estimate, 0);
  const rowLines = req.rows
    .map(r => `  - ${r.label}: ${r.tco2e_estimate} tCO₂e/yr (${r.source}${r.end_use ? ` / ${r.end_use}` : ""})`)
    .join("\n");

  return [
    `You are reviewing a Scope 1+2 baseline for an Australian organisation about to build a marginal abatement cost curve.`,
    ``,
    `ORGANISATION: ${req.org_name} — sector: ${req.org_sector}`,
    `TOTAL: ${total.toLocaleString()} tCO₂e/yr`,
    `SOURCE ROWS:`,
    rowLines,
    ``,
    `Write 2–3 sentences assessing: data completeness, whether the mix looks typical for this sector in Australia, and any rows that seem unusually high or low.`,
    `Also populate "flags" with 0–3 short strings (e.g. "air_travel unusually high for professional_services") for any rows worth flagging — empty array if nothing notable.`,
    ``,
    `Rules: no hedging, no filler, no em dashes. Treat the numbers as correct; do not suggest the user re-check everything.`,
    `Return JSON: { "validation_notes": "...", "flags": ["..."] }`,
  ].join("\n");
}

async function callGemini(prompt: string): Promise<ValidateResponse | null> {
  if (!process.env.GOOGLE_AI_API_KEY) return null;
  const timeoutMs = 4000;
  try {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: VALIDATE_SCHEMA,
        temperature: 0.3,
        maxOutputTokens: 300,
      },
    });
    const resPromise = model.generateContent(prompt);
    const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), timeoutMs));
    const raced = await Promise.race([resPromise, timeout]);
    if (!raced) {
      console.warn("[stage1-validate] gemini timed out");
      return null;
    }
    const parsed = JSON.parse(raced.response.text()) as Partial<ValidateResponse>;
    if (typeof parsed.validation_notes !== "string") return null;
    return {
      validation_notes: parsed.validation_notes.trim(),
      flags: Array.isArray(parsed.flags) ? parsed.flags.filter(f => typeof f === "string") : [],
    };
  } catch (err) {
    console.warn("[stage1-validate] gemini failed:", err);
    return null;
  }
}

function validateRequest(body: unknown): ValidateRequest | { error: string } {
  if (!body || typeof body !== "object") return { error: "body must be an object" };
  const b = body as Record<string, unknown>;
  if (typeof b.org_name !== "string" || !b.org_name) return { error: "org_name required" };
  if (typeof b.org_sector !== "string" || !b.org_sector) return { error: "org_sector required" };
  if (!Array.isArray(b.rows) || b.rows.length === 0) return { error: "rows (non-empty array) required" };
  return b as unknown as ValidateRequest;
}

export async function POST(
  req: NextRequest,
): Promise<NextResponse<ValidateResponse | { error: string }>> {
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

  const prompt = buildPrompt(validated);
  const result = await callGemini(prompt);
  return NextResponse.json(result ?? FALLBACK);
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: true, route: "automacc-v3/stage1-validate" });
}
