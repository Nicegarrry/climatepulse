// src/lib/pipeline/cron-handler.ts
//
// Shared auth + dispatch for the dedicated per-step cron routes under
// /api/pipeline/{ingest,fulltext,enrich,digest,podcast}. Each route is a
// 3-line wrapper that delegates here, and here we reuse the orchestrator's
// singleStep path so pipeline_runs telemetry stays consistent whether a
// step is fired by cron or by a human from the admin dashboard.

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/server";
import { runPipeline } from "@/lib/pipeline/orchestrator";
import type { StepName } from "@/lib/pipeline/types";

export async function handleStepCron(
  req: NextRequest,
  step: StepName
): Promise<NextResponse> {
  const authHeader = req.headers.get("authorization");
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  if (!isCron) {
    const auth = await requireAuth("admin");
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
  }

  console.log(`[cron:${step}] Starting (trigger=${isCron ? "cron" : "manual"})`);

  const result = await runPipeline({
    trigger: isCron ? "cron" : "manual",
    singleStep: step,
  });

  const httpStatus = result.status === "failed" ? 500 : 200;
  return NextResponse.json(result, { status: httpStatus });
}
