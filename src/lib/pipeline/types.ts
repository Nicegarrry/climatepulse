export type StepName = "ingest" | "fulltext" | "enrichment" | "digest";

export type StepStatus = "completed" | "failed" | "skipped";

export type PipelineStatus = "running" | "completed" | "failed" | "partial";

export type PipelineTrigger = "cron" | "manual";

export interface StepResult {
  name: StepName;
  status: StepStatus;
  started_at: string;
  completed_at: string;
  duration_ms: number;
  result: Record<string, unknown>;
  error: string | null;
}

export interface PipelineRunResult {
  id: string;
  started_at: string;
  completed_at: string;
  status: PipelineStatus;
  trigger: PipelineTrigger;
  steps: StepResult[];
  error: string | null;
}
