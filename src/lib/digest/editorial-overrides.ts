import type { DigestOutput, DigestHeroStory, DigestCompactStory } from "@/lib/types";

export interface StoryOverride {
  editors_pick?: boolean;
  editorial_note?: string | null;
  analysis_override?: string | null;
}

export type EditorialOverrides = Record<string, StoryOverride>;

// Extend the hero/compact story shapes with editor-surfaced fields. These are
// consumed by the renderer to show a "Editor's Pick" badge or an editor note.
export interface DigestHeroStoryWithEditorial extends DigestHeroStory {
  editors_pick?: boolean;
  editorial_note?: string | null;
}

export interface DigestCompactStoryWithEditorial extends DigestCompactStory {
  editors_pick?: boolean;
  editorial_note?: string | null;
}

function applyTo<T extends DigestHeroStory | DigestCompactStory>(
  story: T,
  override: StoryOverride
): T & { editors_pick?: boolean; editorial_note?: string | null } {
  const out: T & { editors_pick?: boolean; editorial_note?: string | null } = {
    ...story,
  };
  if (override.editors_pick) out.editors_pick = true;
  if (override.editorial_note) out.editorial_note = override.editorial_note;
  if (override.analysis_override) {
    if ("expert_take" in out) {
      (out as DigestHeroStory).expert_take = override.analysis_override;
    } else if ("one_line_take" in out) {
      (out as DigestCompactStory).one_line_take = override.analysis_override;
    }
  }
  return out;
}

/**
 * Apply editor post-publish overrides to a digest. Suppressed stories are
 * removed; pick/note/analysis-override fields are merged into their stories.
 * Picks are stable-sorted to the top of their lane.
 */
export function applyEditorialOverrides(
  digest: DigestOutput,
  overrides: EditorialOverrides,
  suppressedStoryIds: string[]
): DigestOutput {
  if (!digest) return digest;
  const suppressed = new Set(suppressedStoryIds.map(String));

  const hero = (digest.hero_stories ?? [])
    .filter((s) => !suppressed.has(String(s.rank)))
    .map((s) => applyTo(s, overrides[String(s.rank)] ?? {}));

  const compact = (digest.compact_stories ?? [])
    .filter((s) => !suppressed.has(String(s.rank)))
    .map((s) => applyTo(s, overrides[String(s.rank)] ?? {}));

  // Stable sort — Editor's Pick first, otherwise preserve rank order.
  const byPick = <T extends { editors_pick?: boolean; rank: number }>(a: T, b: T) => {
    const pa = a.editors_pick ? 1 : 0;
    const pb = b.editors_pick ? 1 : 0;
    if (pa !== pb) return pb - pa;
    return a.rank - b.rank;
  };
  hero.sort(byPick);
  compact.sort(byPick);

  return { ...digest, hero_stories: hero, compact_stories: compact };
}
