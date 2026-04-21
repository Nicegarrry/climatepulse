# Share

AI-drafted LinkedIn/Twitter blurbs + branded preview pages for outbound distribution. Shipped to `main` on 2026-04-20.

## Flow

1. Reader hits the Share button on a story or podcast episode
2. Client calls `/api/share/draft` → Gemini Flash-lite generates a blurb in the user's voice based on `role_lens` + `primary_sectors` + `jurisdictions`
3. Overlay copies the blurb to clipboard, then opens the target network (mobile-safe: copy-before-open)
4. Share URL routes to `/share/story/<slug>` or `/share/podcast/<slug>` — a branded preview landing page with OG meta so LinkedIn unfurls cleanly (not a bare publisher URL)
5. Preview page click fires `/api/share/click` which logs to `share_clicks` with a `ref_hash` for conversion attribution

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
