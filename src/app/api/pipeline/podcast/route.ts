import { NextRequest } from "next/server";
import { handleStepCron } from "@/lib/pipeline/cron-handler";

// Claude Sonnet script + Gemini TTS — typically 1-3 minutes end-to-end.
export const maxDuration = 300;

export const GET = (req: NextRequest) => handleStepCron(req, "podcast");
export const POST = (req: NextRequest) => handleStepCron(req, "podcast");
