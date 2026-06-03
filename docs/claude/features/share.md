# Share

AI-drafted LinkedIn/Twitter blurbs + branded preview pages for outbound distribution. Shipped to `main` on 2026-04-20.

## Flow

1. Reader hits the Share button on a story or podcast episode
2. Client calls `/api/share/draft` → Gemini Flash-lite generates a blurb in the user's voice based on `role_lens` + `primary_sectors` + `jurisdictions`
3. Overlay copies the blurb to clipboard, then opens the target network (mobile-safe: copy-before-open)
4. Share URL routes to `/share/story?u=<article_url>` or `/share/podcast?id=<episode_id>` — a branded, login-free preview landing with OG meta so LinkedIn unfurls cleanly (not a bare publisher URL or raw audio blob)
5. Preview page click fires `/api/share/click` which logs to `share_clicks` with a `ref_hash` for conversion attribution

### Podcast share landing (`/share/podcast`)

Mirrors the story landing for the daily episode:
- Plays the episode with an in-house branded transport — `SharePodcastPlayer` (`src/components/share/SharePodcastPlayer.tsx`), a self-contained client player (play/pause, scrub, speed). Deliberately **not** the dashboard `PodcastPlayer`: the share page is anonymous, so it carries no `/api/podcast/interact` telemetry and no nested ShareButton.
- Shows a **truncated** list of the day's top headlines (ranked by `enriched_articles.significance_composite`, anchored to the episode's `briefing_date`). First `HEADLINE_VISIBLE` are plain; the remainder render blurred behind a login CTA.
- CTA resolves to `/dashboard` (authed) or `/login?ref=<hash>` (anon).

### On-domain link fallback

`ShareButton` (`buildFallbackShareUrl`) builds the `/share/*` URL client-side when `/api/share/url` or `/api/share/draft` is slow or errors, so Copy / LinkedIn / Twitter **never** emit the raw source — for podcasts that would leak the bare audio blob URL and skip the landing entirely. A generic `fallbackSocialBlurb` also keeps the LinkedIn/Twitter overlay usable when the AI draft call fails (an empty blurb otherwise disables the Copy & open button).

## Routes

| Route | Purpose |
|---|---|
| `/api/share/draft` | Generate blurb (LinkedIn / Twitter) |
| `/api/share/click` | Log click-throughs on share previews |
| `/api/share/url` | Short-URL generation for share links |
| `/share/story/[slug]` | Preview landing for shared articles |
| `/share/podcast/[slug]` | Preview landing for shared podcast episodes |

## Components

- `src/components/share/` — ShareButton, copy-then-open overlay, previews
- `ShareButton` extended to compact stories + podcast player

## Backlog (all lives in `project_share_feature_backlog` memory)

1. **User `bio` field** — current prompt sees role/sectors/jurisdictions only. A 1–2 sentence `user_profiles.bio TEXT` + onboarding field would let the blurb capture personal voice (e.g. "bizarre summer here in Sydney"). Wire into `buildArticlePrompt()` in `src/app/api/share/draft/route.ts`.
2. **Dedicated `user_profiles.region` column** — currently inferred from `jurisdictions[]` via hand-rolled map in `jurisdictionsToRegion()`. Fine for v1 but brittle.
3. **"Connect LinkedIn" OAuth** — post directly instead of copy-and-paste. Biggest UX win but largest lift. Hold until share volume justifies it.
4. **Blurb caching** — cache by `(article_url, user_id, target)` for 1h if usage ramps. Per-call cost is ~0.01¢.
5. **Share analytics dashboard** — `share_clicks` already logs everything; build an editor-facing view of top shares + per-`ref_hash` signup conversion.

Pick up from the backlog — not new threads — when returning to share work.
