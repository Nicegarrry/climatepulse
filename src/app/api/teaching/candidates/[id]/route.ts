import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/supabase/server";
import {
  approve,
  reject,
  promote,
  CandidateNotFoundError,
  CandidateNotApprovedError,
  GenerationRefusedError,
  GenerationFailedError,
} from "@/lib/learn/concept-cards/candidate-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  action: "approve" | "reject" | "promote";
  reason?: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth("admin");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Body;

  try {
    if (body.action === "approve") {
      await approve([id], auth.user.id);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "reject") {
      await reject([id], auth.user.id, body.reason ?? "rejected");
      return NextResponse.json({ ok: true });
    }
    if (body.action === "promote") {
      // Make sure it's approved first — idempotent.
      await approve([id], auth.user.id);
      const result = await promote(id);
      return NextResponse.json({ ok: true, concept_card_id: result.conceptCardId });
    }
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (err) {
    if (err instanceof CandidateNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof CandidateNotApprovedError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof GenerationRefusedError) {
      return NextResponse.json(
        { error: err.message, kind: "generation_refused" },
        { status: 422 },
      );
    }
    if (err instanceof GenerationFailedError) {
      return NextResponse.json(
        { error: err.message, kind: "generation_failed" },
        { status: 502 },
      );
    }
    if (err && typeof err === "object" && (err as { code?: string }).code === "42P01") {
      return NextResponse.json(
        { error: "learn tables missing — apply Phase 1 migrations" },
        { status: 503 },
      );
    }
    console.error("[teaching/candidates] action failed:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
