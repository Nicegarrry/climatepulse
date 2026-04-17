import type {
  EnrichedArticle,
  UserProfile,
  ScoredStory,
  BriefingDepth,
  TaxonomyTreeNode,
} from "./types";
import { expandToMicrosectorSlugs } from "./expand-sectors";
import type { InteractionSummary } from "./newsroom/types";

// ─── Boost Constants ───────────────────────────────────────────────────────

const BOOST_CAP = 35;
const BOOST_FLOOR = -10;
const INCLUSION_THRESHOLD = 40;
const QUIET_DAY_THRESHOLD = 30;
const BREAKING_NEWS_THRESHOLD = 90;   // Force-include: truly breaking stories only
const GLOBALLY_SIGNIFICANT_THRESHOLD = 85; // Exempt from mismatch penalty (was 80)
const MIN_STORIES_QUICK = 3;
const MAX_DOMAIN_PER_BRIEFING = 3;

export const DEPTH_RANGES: Record<
  BriefingDepth,
  { min: number; max: number; heroes: number; analysisDetail: "brief" | "standard" | "extended" }
> = {
  quick: { min: 3, max: 5, heroes: 3, analysisDetail: "brief" },
  standard: { min: 5, max: 8, heroes: 3, analysisDetail: "standard" },
  deep: { min: 8, max: 12, heroes: 5, analysisDetail: "extended" },
};

// ─── Boost Calculation ─────────────────────────────────────────────────────

interface BoostEntry {
  condition: string;
  boost: number;
}

function computeBoosts(
  story: EnrichedArticle,
  profile: UserProfile,
  expandedSectors: Set<string>,
  interactions?: InteractionSummary
): BoostEntry[] {
  const boosts: BoostEntry[] = [];
  const inherentScore = Number(story.significance_composite) || 50;

  // Story microsector slugs (resolved from DB join)
  const storyMicrosectors = new Set(
    (story.microsector_names ?? []).map((s) =>
      s.toLowerCase().replace(/\s+/g, "-")
    )
  );

  // ── Followed entity match (+25) ──────────────────────────────────────
  if (profile.followed_entities.length > 0 && story.entities) {
    const entityNames = story.entities.map((e) => e.name.toLowerCase());
    for (const followed of profile.followed_entities) {
      if (entityNames.includes(followed.toLowerCase())) {
        boosts.push({ condition: `Followed entity: ${followed}`, boost: 25 });
        break;
      }
    }
  }

  // ── Followed storyline match (+20) ───────────────────────────────────
  if (
    profile.followed_storylines.length > 0 &&
    story.transmission_channels_triggered?.length > 0
  ) {
    for (const followed of profile.followed_storylines) {
      if (
        story.transmission_channels_triggered.some(
          (ch) => ch.toLowerCase() === followed.toLowerCase()
        )
      ) {
        boosts.push({
          condition: `Followed storyline: ${followed}`,
          boost: 20,
        });
        break;
      }
    }
  }

  // ── Sector matching (using expanded microsector slugs) ───────────────
  let hasSectorMatch = false;

  // Primary microsector match (+20) — exact slug match
  for (const slug of storyMicrosectors) {
    if (expandedSectors.has(slug)) {
      boosts.push({ condition: `Sector match: ${slug}`, boost: 20 });
      hasSectorMatch = true;
      break;
    }
  }

  // Domain-level fallback (+15) — when story has no microsector tags but
  // has a primary_domain that maps to the user's expanded sectors.
  // This catches stories the enrichment pipeline tagged at domain level only.
  if (!hasSectorMatch && storyMicrosectors.size === 0 && story.primary_domain) {
    // Check if the story's domain is one the user cares about
    // by seeing if ANY of the user's expanded microsectors belong to this domain
    // We do this by checking if the domain slug itself is in the user's raw primary_sectors
    // (users who selected the domain will have it there pre-expansion)
    if (profile.primary_sectors.includes(story.primary_domain)) {
      boosts.push({ condition: `Domain match: ${story.primary_domain}`, boost: 15 });
      hasSectorMatch = true;
    }
  }

  // Secondary domain match (+12) — story's secondary topic is in user's area
  if (!hasSectorMatch && story.secondary_domain) {
    for (const slug of storyMicrosectors) {
      if (expandedSectors.has(slug)) {
        boosts.push({ condition: `Secondary match: ${slug}`, boost: 12 });
        hasSectorMatch = true;
        break;
      }
    }
    // Also check secondary domain-level fallback
    if (!hasSectorMatch && profile.primary_sectors.includes(story.secondary_domain)) {
      boosts.push({ condition: `Secondary domain: ${story.secondary_domain}`, boost: 10 });
      hasSectorMatch = true;
    }
  }

  // ── Mismatch penalty (-10) ───────────────────────────────────────────
  // If the story has NO sector overlap with the user AND is not globally
  // significant (inherent < 80), penalise to push irrelevant stories down
  if (!hasSectorMatch && inherentScore < GLOBALLY_SIGNIFICANT_THRESHOLD) {
    boosts.push({ condition: "No sector overlap", boost: -10 });
  }

  // ── Jurisdiction match (+10 for non-Australia) ───────────────────────
  if (story.jurisdictions?.length > 0) {
    for (const jur of story.jurisdictions) {
      const jurLower = jur.toLowerCase();
      if (jurLower === "australia" || jurLower === "au") continue;
      if (
        profile.jurisdictions.some((pj) => pj.toLowerCase() === jurLower)
      ) {
        boosts.push({ condition: `Jurisdiction: ${jur}`, boost: 10 });
        break;
      }
    }
  }

  // ── Swipe-right history (+5) ─────────────────────────────────────────
  for (const slug of storyMicrosectors) {
    const history = profile.triage_history[slug];
    if (history && history.swipe_right >= 3) {
      boosts.push({ condition: `Swipe-right history: ${slug}`, boost: 5 });
      break;
    }
  }

  // ── Swipe-left history (-5) ──────────────────────────────────────────
  for (const slug of storyMicrosectors) {
    const history = profile.triage_history[slug];
    if (history && history.swipe_left >= 3) {
      boosts.push({ condition: `Swipe-left history: ${slug}`, boost: -5 });
      break;
    }
  }

  // ── Contradicts prior coverage (+12) ─────────────────────────────────
  // Flagged by Stage 2 enrichment when a story has opposing sentiment +
  // high similarity to recent coverage of the same entities. Contradictory
  // reporting is a strong signal to a professional audience — surface it.
  if (story.contradicts_prior) {
    boosts.push({ condition: "Contradicts prior coverage", boost: 12 });
  }

  // ── Newsroom interaction boost ───────────────────────────────────────
  // Direct: same article previously surfaced via Newsroom → boost based
  // on the strongest signal the user gave it.
  // Soft: entity overlap (the same wire item won't be the same DB row as
  // the enriched briefing story, so we propagate via shared entities).
  if (interactions) {
    const direct = story.raw_article_id
      ? interactions.byArticle.get(story.raw_article_id)
      : undefined;
    if (direct) {
      if (direct.saved)
        boosts.push({ condition: "Saved previously", boost: 18 });
      if (direct.thumbs === 1)
        boosts.push({ condition: "Thumbs up", boost: 10 });
      if (direct.thumbs === -1)
        boosts.push({ condition: "Thumbs down", boost: -15 });
      const readBoost = Math.min(direct.reads * 3, 6);
      if (readBoost > 0)
        boosts.push({ condition: `Read ${direct.reads}×`, boost: readBoost });
    }

    // Softer entity propagation. Cap at one matched entity per story to
    // avoid stacking; saves win over thumbs.
    if (story.entities && story.entities.length > 0) {
      let entityBoosted = false;
      for (const e of story.entities) {
        if (entityBoosted) break;
        const key = e.name?.toLowerCase().trim();
        if (!key || key.length < 3) continue;
        const ent = interactions.byEntity.get(key);
        if (!ent) continue;
        if (ent.saves > 0) {
          boosts.push({ condition: `Entity saved: ${e.name}`, boost: 9 });
          entityBoosted = true;
        } else if (ent.positive > ent.negative) {
          boosts.push({ condition: `Entity engaged: ${e.name}`, boost: 5 });
          entityBoosted = true;
        }
      }
    }
  }

  return boosts;
}

// ─── Score a single story ──────────────────────────────────────────────────

export function computePersonalScore(
  story: EnrichedArticle,
  profile: UserProfile,
  expandedSectors: Set<string>,
  interactions?: InteractionSummary
): ScoredStory {
  const inherentScore = Number(story.significance_composite) || 50;
  const boosts = computeBoosts(story, profile, expandedSectors, interactions);

  const rawBoost = boosts.reduce((sum, b) => sum + b.boost, 0);
  const cappedBoost = Math.max(BOOST_FLOOR, Math.min(rawBoost, BOOST_CAP));
  const personalScore = inherentScore + cappedBoost;

  return {
    id: story.id,
    title: story.title,
    source_name: story.source_name,
    article_url: story.article_url,
    snippet: story.snippet,
    full_text: story.full_text ?? null,
    signal_type: story.signal_type,
    primary_domain: story.primary_domain ?? null,
    secondary_domain: story.secondary_domain ?? null,
    microsector_slugs: story.microsector_names ?? [],
    secondary_microsector_slugs: [],
    entities: (story.entities ?? []).map((e) => ({
      id: e.id,
      name: e.name,
      type: e.type,
    })),
    quantitative_data: story.quantitative_data,
    jurisdictions: story.jurisdictions ?? [],
    inherent_score: inherentScore,
    context_quality: story.context_quality,
    source_authority:
      story.significance_scores?.source_authority?.score ?? 5,
    linked_storylines: [],
    transmission_channels_triggered:
      story.transmission_channels_triggered ?? [],
    personal_score: personalScore,
    relevance_boost: cappedBoost,
    boost_breakdown: boosts,
    designation: "compact", // set later by selection
  };
}

// ─── Select stories for briefing ───────────────────────────────────────────

export function selectBriefingStories(
  stories: EnrichedArticle[],
  profile: UserProfile,
  taxonomyTree?: TaxonomyTreeNode[],
  interactions?: InteractionSummary
): ScoredStory[] {
  // 0. Expand user's primary_sectors to microsector slugs
  const expandedSectors = taxonomyTree
    ? expandToMicrosectorSlugs(profile.primary_sectors, taxonomyTree)
    : new Set(profile.primary_sectors);

  // 1. Deduplicate stories by title (keep highest inherent score version)
  const titleMap = new Map<string, EnrichedArticle>();
  for (const story of stories) {
    const key = story.title.toLowerCase().trim();
    const existing = titleMap.get(key);
    if (!existing || (Number(story.significance_composite) || 0) > (Number(existing.significance_composite) || 0)) {
      titleMap.set(key, story);
    }
  }
  const deduped = Array.from(titleMap.values());

  // 2. Score all stories (Newsroom interaction history strengthens or
  //    weakens the boost — see computeBoosts for the per-signal weights).
  const scored = deduped.map((s) =>
    computePersonalScore(s, profile, expandedSectors, interactions)
  );

  // 3. Breaking news always included (inherent >= 90)
  const breaking = scored.filter(
    (s) => s.inherent_score >= BREAKING_NEWS_THRESHOLD
  );

  // 4. Filter by threshold
  let threshold = INCLUSION_THRESHOLD;
  let filtered = scored.filter((s) => s.personal_score >= threshold);

  // Quiet day fallback
  if (filtered.length < MIN_STORIES_QUICK) {
    threshold = QUIET_DAY_THRESHOLD;
    filtered = scored.filter((s) => s.personal_score >= threshold);
  }

  // Ensure breaking news is always included (inherent >= 90 only)
  for (const b of breaking) {
    if (!filtered.find((f) => f.id === b.id)) {
      filtered.push(b);
    }
  }

  // 5. Sort by personal_score descending
  filtered.sort((a, b) => b.personal_score - a.personal_score);

  // 6. Apply diversity constraint: max 3 per domain
  const domainCounts: Record<string, number> = {};
  const diverse: ScoredStory[] = [];

  for (const story of filtered) {
    const domain = story.primary_domain ?? "unknown";
    const count = domainCounts[domain] ?? 0;
    if (count < MAX_DOMAIN_PER_BRIEFING) {
      diverse.push(story);
      domainCounts[domain] = count + 1;
    }
  }

  // 7. Select top N by briefing depth
  const depth = DEPTH_RANGES[profile.briefing_depth];
  const selected = diverse.slice(0, depth.max);

  // 8. Designate hero vs compact (hero count varies by depth)
  return selected.map((story, i) => ({
    ...story,
    designation: i < depth.heroes ? ("hero" as const) : ("compact" as const),
  }));
}
