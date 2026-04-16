"use client";

import { COLORS } from "@/lib/design-tokens";
import { Micro, WobblyRule } from "@/components/intelligence/primitives";
import { CurrentDigest } from "@/components/weekly/current-digest";
import type { WeeklyDigest } from "@/lib/types";

interface PreviewPanelProps {
  draft: Partial<WeeklyDigest>;
}

// Fills in safe defaults so CurrentDigest can render the preview before all
// fields are filled in.
function toDigest(draft: Partial<WeeklyDigest>): WeeklyDigest {
  return {
    id: draft.id ?? "preview",
    report_id: draft.report_id ?? null,
    week_start: draft.week_start ?? "",
    week_end: draft.week_end ?? "",
    status: draft.status ?? "draft",
    headline: draft.headline ?? "(Untitled headline)",
    editor_narrative: draft.editor_narrative ?? "",
    weekly_number: draft.weekly_number ?? null,
    curated_stories: draft.curated_stories ?? [],
    theme_commentary: draft.theme_commentary ?? null,
    outlook: draft.outlook ?? null,
    published_at: draft.published_at ?? null,
    banner_expires_at: draft.banner_expires_at ?? null,
    linkedin_draft: draft.linkedin_draft ?? null,
    created_at: draft.created_at ?? new Date().toISOString(),
  };
}

export function PreviewPanel({ draft }: PreviewPanelProps) {
  const digest = toDigest(draft);
  return (
    <div
      style={{
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 10,
        padding: 18,
      }}
    >
      <Micro>Preview</Micro>
      <div style={{ fontSize: 10, color: COLORS.inkFaint, marginTop: 2, marginBottom: 6 }}>
        Live preview of how the Weekly tab will render this digest.
      </div>
      <WobblyRule color={COLORS.borderLight} />
      <div style={{ marginTop: 14 }}>
        <CurrentDigest digest={digest} />
      </div>
    </div>
  );
}
