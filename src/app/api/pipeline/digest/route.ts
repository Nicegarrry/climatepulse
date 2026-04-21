import { NextRequest } from "next/server";
import { handleStepCron } from "@/lib/pipeline/cron-handler";

// Claude Sonnet + optional web-search pre-pass runs per user, serially.
// Each user takes ~40s, so at 300s we'd cap around 7 users before
// FUNCTION_INVOCATION_TIMEOUT kills the worker mid-loop (confirmed on the
// 2026-04-20 run: 7 of 9 users written, then timeout). 800s is the Vercel
// Pro ceiling — same value used by the enrich step.
export const maxDuration = 800;

export const GET = (req: NextRequest) => handleStepCron(req, "digest");
export const POST = (req: NextRequest) => handleStepCron(req, "digest");
