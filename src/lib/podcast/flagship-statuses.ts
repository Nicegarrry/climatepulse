export const FLAGSHIP_STATUSES = [
  "idea",
  "drafted",
  "scheduled",
  "published",
  "archived",
] as const;

export type FlagshipStatus = (typeof FLAGSHIP_STATUSES)[number];

export function isFlagshipStatus(v: unknown): v is FlagshipStatus {
  return typeof v === "string" && (FLAGSHIP_STATUSES as readonly string[]).includes(v);
}
