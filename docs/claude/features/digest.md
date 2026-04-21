# Daily Digest (Phase 3)

Personalised Sonnet-generated briefing per user. Reader-facing surface is the Briefing ("Intelligence") tab.

## Core

- Single entry point: `src/lib/digest/generate.ts::generateBriefingForUser(userId, { mock })`
- Called by both the HTTP route and the pipeline's `step4Digest` — direct function invocation, never self-fetch. A prior version tried `fetch('http://localhost:3000')` from inside a Vercel serverless function and 500'd every run.
- Uses mock data when `ANTHROPIC_API_KEY` is unset; calls Claude Sonnet when set.
- **Capped at 15 stories total** sent to Sonnet regardless of sector count.

## Briefing structure

- **Daily Number** — a single quantitative anchor extracted from the day's stories
- **Narrative synthesis** — short opening paragraph
- **Hero stories** — expert-analysis treatment (small number)
- **Compact stories** — accordion list
- **Cross-story connections** — callouts where two stories interact

UI components: `src/components/intelligence/`.

## Personalisation

`src/lib/personalisation.ts`:

- `computeBoosts(userProfile, stories, interactions?)` — combines sector affinity, jurisdiction match, role-lens, and behavioural signals
- `selectBriefingStories(stories, boosts)` — applies caps and picks final 15
- Boost clamps: `BOOST_CAP=35`, `BOOST_FLOOR=-10`
- +12 boost when `story.contradicts_prior` is true

**Newsroom feedback loop** feeds in via `getInteractionSummary(userId)` from `src/lib/newsroom/interactions.ts`:

| Event | Boost |
|---|---|
| `read` / `expand` | +3 each, capped at +6 |
| `thumbs_up` | +10 |
| `thumbs_down` | −15 |
| `save` | +18 |
| Entity propagation (engaged) | +5 once per story |
| Entity propagation (saved) | +9 once per story |

Entity propagation bridges the UUID gap between Newsroom `newsroom_items` and enriched briefing stories using shared entity names.

## RAG prior-coverage hook

Per HERO story, `fetchPriorCoverage()`:

1. Calls `retrieveContent` with: entity overlap + trust tiers 0/1 + 3-day lookback cutoff
2. Injects hits into the Claude prompt as a per-story "Prior ClimatePulse coverage" block
3. Claude is instructed to reference prior coverage only when it reframes today's piece

Wrapped in try/catch — RAG failures never block the digest.

See [`../architecture/rag.md`](../architecture/rag.md) for retriever primitives.

## Gotchas

- Don't send more than 15 articles to Sonnet. There's no quality win and the cost scales linearly.
- `published_at` must be coerced to an ISO string before going into the prior-coverage block — Postgres returns a Date, and the Claude prompt template chokes on it (fixed in commit `f6ff54d`).
- The admin `/api/pipeline/digest` route and the HTTP digest route are different things — don't wire the cron to a self-fetch of the HTTP route.
