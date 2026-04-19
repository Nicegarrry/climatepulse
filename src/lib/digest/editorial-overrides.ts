import type {
  DigestOutput,
  DigestHeroStory,
  DigestCompactStory,
} from "@/lib/types";

// ─── Schema ───────────────────────────────────────────────────────────────
// editorial_overrides JSONB holds per-story overrides keyed by rank (as a
// string), plus a reserved `__meta` key for digest-wide overrides (intro
// text, explicit story order, and stories injected by the editor that the
// pipeline did not surface).

export interface InjectedStory {
  rank: number;
  headline: string;
  source: string;
  url: string;
  take: string;
  lane: "hero" | "compact";
  micro_sectors?: string[];
  key_metric?: { value: string; unit: string; delta?: string } | null;
}

export interface EditorialMeta {
  digest_intro?: string | null;
  story_order?: number[]; // explicit rank order, applied within each lane
  injected_stories?: InjectedStory[];
}

export interface StoryOverride {
  editors_pick?: boolean;
  editorial_note?: string | null;
  analysis_override?: string | null;
  sector_tags?: string[] | null;
}

export type EditorialOverrides = Record<string, StoryOverride | EditorialMeta>;

export const META_KEY = "__meta" as const;

export function getMeta(overrides: EditorialOverrides | null | undefined): EditorialMeta {
  if (!overrides) return {};
  const m = overrides[META_KEY] as EditorialMeta | undefined;
  return m ?? {};
}

export function getStoryOverrides(
  overrides: EditorialOverrides | null | undefined
): Record<string, StoryOverride> {
  const out: Record<string, StoryOverride> = {};
  if (!overrides) return out;
  for (const [k, v] of Object.entries(overrides)) {
    if (k === META_KEY) continue;
    out[k] = v as StoryOverride;
  }
  return out;
}

// ─── Applied-output types ────────────────────────────────────────────────

export interface DigestHeroStoryWithEditorial extends DigestHeroStory {
  editors_pick?: boolean;
  editorial_note?: string | null;
}

export interface DigestCompactStoryWithEditorial extends DigestCompactStory {
  editors_pick?: boolean;
  editorial_note?: string | null;
}

export interface DigestOutputWithEditorial extends DigestOutput {
  digest_intro?: string | null;
  hero_stories: DigestHeroStoryWithEditorial[];
  compact_stories: DigestCompactStoryWithEditorial[];
}

// ─── Apply helpers ───────────────────────────────────────────────────────

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
  if (override.sector_tags && "micro_sectors" in out) {
    (out as DigestHeroStory).micro_sectors = override.sector_tags;
  }
  return out;
}

function injectedToHero(i: InjectedStory): DigestHeroStory {
  return {
    rank: i.rank,
    headline: i.headline,
    source: i.source,
    url: i.url,
    expert_take: i.take,
    key_metric: i.key_metric ?? null,
    so_what: null,
    connected_storyline: null,
    micro_sectors: i.micro_sectors ?? [],
    entities_mentioned: [],
  };
}

function injectedToCompact(i: InjectedStory): DigestCompactStory {
  return {
    rank: i.rank,
    headline: i.headline,
    source: i.source,
    url: i.url,
    one_line_take: i.take,
    key_metric: i.key_metric ?? null,
  };
}

/**
 * Apply editor post-publish overrides to a digest. Suppressed stories are
 * removed; pick/note/analysis/sector overrides are merged into their stories;
 * injected stories are appended to their lane; explicit story_order and
 * Editor's Pick determine the final ordering; digest_intro is surfaced as
 * an extra field.
 */
export function applyEditorialOverrides(
  digest: DigestOutput,
  overrides: EditorialOverrides,
  suppressedStoryIds: string[]
): DigestOutputWithEditorial {
  if (!digest) return digest as DigestOutputWithEditorial;

  const suppressed = new Set(suppressedStoryIds.map(String));
  const storyOver = getStoryOverrides(overrides);
  const meta = getMeta(overrides);

  let hero = (digest.hero_stories ?? [])
    .filter((s) => !suppressed.has(String(s.rank)))
    .map((s) => applyTo(s, storyOver[String(s.rank)] ?? {}));

  let compact = (digest.compact_stories ?? [])
    .filter((s) => !suppressed.has(String(s.rank)))
    .map((s) => applyTo(s, storyOver[String(s.rank)] ?? {}));

  // Inject editor-added stories (not originally surfaced by the pipeline).
  const injected = meta.injected_stories ?? [];
  for (const i of injected) {
    if (suppressed.has(String(i.rank))) continue;
    const o = storyOver[String(i.rank)] ?? {};
    if (i.lane === "hero") {
      hero.push(applyTo(injectedToHero(i), o));
    } else {
      compact.push(applyTo(injectedToCompact(i), o));
    }
  }

  // Ordering: (1) explicit story_order if provided, (2) Editor's Pick first,
  // (3) original rank. Stable within ties.
  const orderIndex = new Map<number, number>();
  (meta.story_order ?? []).forEach((rank, idx) => orderIndex.set(rank, idx));

  const sorter = <T extends { editors_pick?: boolean; rank: number }>(
    a: T,
    b: T
  ): number => {
    const oa = orderIndex.get(a.rank);
    const ob = orderIndex.get(b.rank);
    if (oa !== undefined && ob !== undefined) return oa - ob;
    if (oa !== undefined) return -1;
    if (ob !== undefined) return 1;
    const pa = a.editors_pick ? 1 : 0;
    const pb = b.editors_pick ? 1 : 0;
    if (pa !== pb) return pb - pa;
    return a.rank - b.rank;
  };
  hero = hero.sort(sorter);
  compact = compact.sort(sorter);

  return {
    ...digest,
    digest_intro: meta.digest_intro ?? null,
    hero_stories: hero,
    compact_stories: compact,
  };
}
