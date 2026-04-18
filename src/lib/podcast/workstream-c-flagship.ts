// Workstream C — flagship episode auto-link on weekly-digest publish.
// When an editor publishes a weekly digest, we look for a scheduled
// flagship episode whose `scheduled_for` falls within the digest's
// week (+/- 3 days). If found, link it, mark it published, and record
// a podcast_episodes row tied to it.
//
// This workstream does NOT auto-generate the flagship audio — that's a
// long-running (~45 min runtime, multiple Sonnet calls) task triggered
// manually from the editor UI. It only wires the DB linkage so the
// archive + UI surface the flagship alongside the published digest.

import pool from "@/lib/db";

export interface FlagshipLinkResult {
  status: "linked" | "skipped";
  reason?: string;
  flagship_episode_id?: string;
  podcast_episode_id?: string;
}

export async function autoLinkFlagshipOnPublish(
  weeklyDigestId: string
): Promise<FlagshipLinkResult> {
  const digestRow = await pool.query(
    `SELECT id, week_start, week_end FROM weekly_digests WHERE id = $1`,
    [weeklyDigestId]
  );
  if (digestRow.rows.length === 0) {
    return { status: "skipped", reason: "digest not found" };
  }
  const { week_start, week_end } = digestRow.rows[0] as {
    week_start: string;
    week_end: string;
  };

  const flagship = await pool.query(
    `SELECT id, title, episode_number
       FROM flagship_episodes
       WHERE status = 'scheduled'
         AND scheduled_for IS NOT NULL
         AND scheduled_for BETWEEN ($1::date - INTERVAL '3 days') AND ($2::date + INTERVAL '3 days')
       ORDER BY scheduled_for
       LIMIT 1`,
    [week_start, week_end]
  );
  if (flagship.rows.length === 0) {
    return { status: "skipped", reason: "no scheduled flagship in window" };
  }

  const flagshipRow = flagship.rows[0] as {
    id: string;
    title: string;
    episode_number: number | null;
  };

  // Assign episode_number if unset (next sequential).
  if (flagshipRow.episode_number == null) {
    const seq = await pool.query(
      `SELECT COALESCE(MAX(episode_number), 0) + 1 AS next FROM flagship_episodes`
    );
    await pool.query(
      `UPDATE flagship_episodes SET episode_number = $1, linked_weekly_digest_id = $2, status = 'published', published_at = NOW() WHERE id = $3`,
      [seq.rows[0].next, weeklyDigestId, flagshipRow.id]
    );
  } else {
    await pool.query(
      `UPDATE flagship_episodes SET linked_weekly_digest_id = $1, status = 'published', published_at = NOW() WHERE id = $2`,
      [weeklyDigestId, flagshipRow.id]
    );
  }

  return {
    status: "linked",
    flagship_episode_id: flagshipRow.id,
  };
}
