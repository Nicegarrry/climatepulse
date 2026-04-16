import { NextRequest } from "next/server";
import { handleStepCron } from "@/lib/pipeline/cron-handler";

// RSS + scrape + 2 APIs in parallel — always completes in under a minute.
export const maxDuration = 300;

export const GET = (req: NextRequest) => handleStepCron(req, "ingest");
export const POST = (req: NextRequest) => handleStepCron(req, "ingest");
