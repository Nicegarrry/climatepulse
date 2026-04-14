// ─── Analytics Event Taxonomy ──────────────────────────────────────────────
// Typed event names + property maps for compile-time safety.
// Pattern: [object].[action] in snake_case.

export type AnalyticsEventName =
  // Briefing lifecycle
  | "briefing.viewed"
  | "briefing.generated"
  | "briefing.started"
  | "briefing.completed"
  | "briefing.abandoned"
  // Story interactions
  | "story.viewed"
  | "story.clicked"
  | "story.accordion_opened"
  | "story.skipped"
  // Navigation
  | "tab.switched"
  | "session.started"
  // Streak
  | "streak.achieved"
  | "streak.broken"
  | "streak.grace_used"
  // Weekly Pulse
  | "weekly_pulse.viewed"
  | "weekly_pulse.missed_story_tapped"
  | "weekly_pulse.sector_nudge_tapped"
  // Source links
  | "source.tapped";

export interface AnalyticsEventProperties {
  "briefing.viewed": { edition_date: string; stories_count: number };
  "briefing.generated": { edition_date: string };
  "briefing.started": {
    edition_date: string;
    stories_count: number;
    entry_point: "card" | "story_row";
  };
  "briefing.completed": {
    edition_date: string;
    stories_viewed: number;
    total_duration_seconds: number;
    streak_after?: number;
  };
  "briefing.abandoned": {
    edition_date: string;
    stories_viewed: number;
    abandoned_at_position: number;
    duration_seconds: number;
  };
  "story.viewed": {
    story_id: string;
    position: number;
    sector?: string;
    duration_seconds: number;
  };
  "story.clicked": {
    story_id: string;
    source_name?: string;
    source_url?: string;
  };
  "story.accordion_opened": {
    story_rank: number;
  };
  "story.skipped": {
    story_id: string;
    position: number;
    sector?: string;
  };
  "tab.switched": { from: string; to: string };
  "session.started": { source?: "organic" | "push" | "link" };
  "streak.achieved": {
    streak_length: number;
    is_new_record: boolean;
  };
  "streak.broken": {
    previous_length: number;
    days_since_last: number;
  };
  "streak.grace_used": { streak_length: number };
  "weekly_pulse.viewed": { week_start: string };
  "weekly_pulse.missed_story_tapped": { story_id: string };
  "weekly_pulse.sector_nudge_tapped": { sector: string };
  "source.tapped": {
    story_id: string;
    source_name: string;
    source_url: string;
  };
}

export interface QueuedEvent {
  event_name: AnalyticsEventName;
  properties: Record<string, unknown>;
  session_id: string;
  timestamp: string;
}
