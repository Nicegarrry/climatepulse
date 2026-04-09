// src/app/api/pipeline/run/route.ts

import { NextRequest, NextResponse } from "next/server";
import { runPipeline } from "@/lib/pipeline/orchestrator";
import type { StepName } from "@/lib/pipeline/types";

// Allow up to 15 minutes for the full pipeline
export const maxDuration = 900;

const VALID_STEPS: StepName[] = ["ingest", "fulltext", "enrichment", "digest"];

export async function POST(req: NextRequest) {
  // TODO(deploy): Add CRON_SECRET auth check before deploying to production
  // See docs/BACKLOG.md for details

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
