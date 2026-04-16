// src/app/api/pipeline/run/route.ts

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/server";
import { runPipeline } from "@/lib/pipeline/orchestrator";
import type { StepName } from "@/lib/pipeline/types";

// Vercel Pro caps Serverless Functions at 800s (~13m 20s). Full pipeline runs within that.
export const maxDuration = 800;

const VALID_STEPS: StepName[] = ["ingest", "fulltext", "enrichment", "digest", "podcast"];

async function handle(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  if (!isCron) {
    const auth = await requireAuth("admin");
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
  }

  const singleStep = req.nextUrl.searchParams.get("step") as StepName | null;
  const dry = req.nextUrl.searchParams.get("dry") === "true";

  if (singleStep && !VALID_STEPS.includes(singleStep)) {
    return NextResponse.json(
      { error: `Invalid step: ${singleStep}. Valid: ${VALID_STEPS.join(", ")}` },
      { status: 400 }
    );
  }

  console.log(
    `[pipeline] Starting${singleStep ? ` (step=${singleStep})` : ""}${dry ? " (DRY RUN)" : ""}`
  );

  const result = await runPipeline({
    trigger: "cron",
    singleStep: singleStep ?? undefined,
    dry,
  });

  const httpStatus = result.status === "failed" ? 500 : 200;
  return NextResponse.json(result, { status: httpStatus });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
