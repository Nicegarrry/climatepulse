import pool from "@/lib/db";

export type PodcastInteractionType =
  | "play"
  | "resume"
  | "complete"
  | "quit"
  | "skip_back"
  | "skip_forward";

export const PODCAST_INTERACTION_TYPES: PodcastInteractionType[] = [
  "play",
  "resume",
  "complete",
  "quit",
  "skip_back",
  "skip_forward",
];

export function isPodcastInteractionType(v: unknown): v is PodcastInteractionType {
  return typeof v === "string" && (PODCAST_INTERACTION_TYPES as string[]).includes(v);
}

export async function recordInteraction(
  userId: string,
  podcastEpisodeId: string,
  type: PodcastInteractionType,
  positionSeconds: number | null = null
): Promise<void> {
  await pool.query(
    `INSERT INTO user_podcast_interactions
       (user_id, podcast_episode_id, interaction_type, position_seconds)
     VALUES ($1, $2, $3, $4)`,
    [userId, podcastEpisodeId, type, positionSeconds]
  );
}
