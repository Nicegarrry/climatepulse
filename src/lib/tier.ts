import pool from "@/lib/db";

export type Tier = "founder" | "launch" | "paid" | "free";

export const SECTORS_LIMIT_FREE = 3;

const TIER_LEVEL: Record<Tier, number> = {
  free: 0,
  launch: 1,
  paid: 1,
  founder: 2,
};

export type Feature =
  | "unlimited_sectors"
  | "research_surface"
  | "learn_surface"
  | "themed_podcasts";

const FEATURE_MIN_TIER: Record<Feature, Tier> = {
  unlimited_sectors: "launch",
  research_surface: "launch",
  learn_surface: "launch",
  themed_podcasts: "launch",
};

export function canAccessFeature(tier: Tier, feature: Feature): boolean {
  return TIER_LEVEL[tier] >= TIER_LEVEL[FEATURE_MIN_TIER[feature]];
}

export function sectorLimit(tier: Tier): number | null {
  return canAccessFeature(tier, "unlimited_sectors") ? null : SECTORS_LIMIT_FREE;
}

export async function getTier(userId: string): Promise<Tier> {
  const { rows } = await pool.query<{ tier: Tier }>(
    `SELECT tier FROM user_profiles WHERE id = $1`,
    [userId]
  );
  return rows[0]?.tier ?? "free";
}

// TODO(post-launch): Stripe checkout + webhook that flips tier between free / paid
// on subscription.created / .updated / .deleted. Trial handler sets trial_started_at
// + trial_ends_at (now() + 7 days) and treats the window as `paid`.
