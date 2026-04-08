import type {
  EnrichedArticle,
  UserProfile,
  ScoredStory,
  BriefingDepth,
} from "./types";

// ─── Boost Constants ───────────────────────────────────────────────────────

const BOOST_CAP = 35;
const INCLUSION_THRESHOLD = 40;
const QUIET_DAY_THRESHOLD = 30;
const BREAKING_NEWS_THRESHOLD = 90;
const GLOBALLY_SIGNIFICANT_THRESHOLD = 80;
const MIN_STORIES_QUICK = 3;
const MAX_DOMAIN_PER_BRIEFING = 3;

const DEPTH_RANGES: Record<BriefingDepth, { min: number; max: number }> = {
  quick: { min: 3, max: 5 },
  standard: { min: 5, max: 8 },
  deep: { min: 8, max: 12 },
};

// ─── Boost Calculation ─────────────────────────────────────────────────────

interface BoostEntry {
  condition: string;
  boost: number;
}

function computeBoosts(
  story: EnrichedArticle,
  profile: UserProfile
): BoostEntry[] {
  const boosts: BoostEntry[] = [];

  // Followed entity match (+25)
  if (profile.followed_entities.length > 0 && story.entities) {
    const entityNames = story.entities.map((e) => e.name.toLowerCase());
    for (const followed of profile.followed_entities) {
      if (entityNames.includes(followed.toLowerCase())) {
        boosts.push({ condition: `Followed entity: ${followed}`, boost: 25 });
        break; // only count once
      }
    }
  }

  // Followed storyline match (+20)
  // Future: match against story.linked_storylines when available
  // For now, check transmission_channels_triggered as a proxy
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

  // Primary micro-sector match (+15)
  const microsectorSlugs = (story.microsector_names ?? []).map((s) =>
    s.toLowerCase().replace(/\s+/g, "-")
  );
  // Also check raw microsector_ids mapped to slugs if available
  const storyMicrosectors = new Set([
    ...microsectorSlugs,
    ...(story.primary_domain ? [story.primary_domain] : []),
  ]);

  let primaryMatch = false;
  for (const sector of profile.primary_sectors) {
    if (storyMicrosectors.has(sector)) {
      boosts.push({ condition: `Primary sector: ${sector}`, boost: 15 });
      primaryMatch = true;
      break;
    }
  }

  // Secondary micro-sector match (+8) — only if no primary match
  if (!primaryMatch && story.secondary_domain) {
    for (const sector of profile.primary_sectors) {
      if (story.secondary_domain === sector) {
        boosts.push({ condition: `Secondary sector: ${sector}`, boost: 8 });
        break;
      }
    }
  }

  // Jurisdiction match (+10 for non-Australia)
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

  // Implicit: swipe-right history (+5)
  for (const slug of storyMicrosectors) {
    const history = profile.triage_history[slug];
    if (history && history.swipe_right >= 3) {
      boosts.push({ condition: `Swipe-right history: ${slug}`, boost: 5 });
      break;
    }
  }

  // Implicit: swipe-left history (-5)
  for (const slug of storyMicrosectors) {
    const history = profile.triage_history[slug];
    if (history && history.swipe_left >= 3) {
      boosts.push({ condition: `Swipe-left history: ${slug}`, boost: -5 });
      break;
    }
  }

  // Implicit: engagement pattern from accordion opens (+3)
  if (story.signal_type && profile.accordion_opens) {
    const recentOpens = Object.values(profile.accordion_opens).length;
    if (recentOpens >= 3) {
      boosts.push({ condition: "Engagement pattern", boost: 3 });
    }
  }

  return boosts;
}

// ─── Score a single story ──────────────────────────────────────────────────

export function computePersonalScore(
  story: EnrichedArticle,
  profile: UserProfile
): ScoredStory {
  const inherentScore = story.significance_composite ?? 50;
  const boosts = computeBoosts(story, profile);

  const rawBoost = boosts.reduce((sum, b) => sum + b.boost, 0);
  const cappedBoost = Math.min(rawBoost, BOOST_CAP);
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
  profile: UserProfile
): ScoredStory[] {
  // 1. Score all stories
  let scored = stories.map((s) => computePersonalScore(s, profile));

  // 2. Breaking news always included (inherent >= 90)
  const breaking = scored.filter(
    (s) => s.inherent_score >= BREAKING_NEWS_THRESHOLD
  );

  // 3. Filter by threshold
  let threshold = INCLUSION_THRESHOLD;
  let filtered = scored.filter((s) => s.personal_score >= threshold);

  // Quiet day fallback
  if (filtered.length < MIN_STORIES_QUICK) {
    threshold = QUIET_DAY_THRESHOLD;
    filtered = scored.filter((s) => s.personal_score >= threshold);
  }

  // Ensure breaking news is always included
  for (const b of breaking) {
    if (!filtered.find((f) => f.id === b.id)) {
      filtered.push(b);
    }
  }

  // Globally significant stories always included
  for (const s of scored) {
    if (
      s.inherent_score >= GLOBALLY_SIGNIFICANT_THRESHOLD &&
      !filtered.find((f) => f.id === s.id)
    ) {
      filtered.push(s);
    }
  }

  // 4. Sort by personal_score descending
  filtered.sort((a, b) => b.personal_score - a.personal_score);

  // 5. Apply diversity constraint: max 3 per domain
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

  // 6. Select top N by briefing depth
  const { max } = DEPTH_RANGES[profile.briefing_depth];
  const selected = diverse.slice(0, max);

  // 7. Designate hero (top 3) vs compact
  return selected.map((story, i) => ({
    ...story,
    designation: i < 3 ? ("hero" as const) : ("compact" as const),
  }));
}
