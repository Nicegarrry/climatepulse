import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/supabase/server";
import { generatePath } from "@/lib/learn/path-generator";

/**
 * POST /api/learn/paths/generate
 * Env-gated: returns 503 { refused: "generation_disabled" } unless
 * LEARN_GENERATION_ENABLED === "true".
 *
 * Body: { freeText }
 * Returns: PathGenerationResult — either { plan, warnings } or { refused }.
 */
export async function POST(req: NextRequest) {
  if (process.env.LEARN_GENERATION_ENABLED !== "true") {
    return NextResponse.json(
      { refused: "generation_disabled" },
      { status: 503 },
    );
  }

  const auth = await requireAuth();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: { freeText?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const freeText = body.freeText?.trim();
  if (!freeText) {
    return NextResponse.json(
      { error: "freeText is required" },
      { status: 400 },
    );
  }

  try {
    const result = await generatePath(freeText, { userId: auth.user.id });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/learn/paths/generate] failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 },
    );
  }
}
