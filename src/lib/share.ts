import crypto from "crypto";
import pool from "@/lib/db";

/**
 * Returns a stable 10-char hash of the given user id, ensuring it's persisted
 * to user_profiles.ref_hash so that `/signup?ref=<hash>` can attribute inbound
 * referrals without exposing the raw Supabase user id.
 */
export async function getOrCreateRefHash(userId: string): Promise<string | null> {
  if (!userId) return null;
  const hash = crypto.createHash("sha256").update(userId).digest("hex").slice(0, 10);
  try {
    await pool.query(
      `UPDATE user_profiles SET ref_hash = $1 WHERE id = $2 AND ref_hash IS DISTINCT FROM $1`,
      [hash, userId]
    );
  } catch {
    // ref_hash column missing on older DBs — degrade gracefully.
    return null;
  }
  return hash;
}

export async function resolveRefHash(hash: string): Promise<string | null> {
  if (!hash) return null;
  try {
    const { rows } = await pool.query<{ id: string }>(
      `SELECT id FROM user_profiles WHERE ref_hash = $1 LIMIT 1`,
      [hash]
    );
    return rows[0]?.id ?? null;
  } catch {
    return null;
  }
}
