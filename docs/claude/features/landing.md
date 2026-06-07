# Marketing Landing (`/`)

Public, server-rendered, SEO-indexable landing page. Returning users are redirected server-side to **`/launchpad`** before any HTML renders.

## Structure

A clutter-stripped, single-action conversion funnel ("Front Desk"). One oversized forest **"Sign up now"** (→ `/login`) is the heaviest object on every viewport; a smaller secondary **"See today's dashboard without logging in"** (→ `/today`) is a quiet ghost link.

- Entry: `src/app/page.tsx` (server component) — after the returning-user redirect it calls `getPublicDigest()` (wrapped in `unstable_cache`, `revalidate: 600`) and passes `topStories={stories.slice(0,3)}` + `signalsTracked` into `<Landing/>`. The board is server-rendered: zero client fetch, zero per-visitor AI cost. `getPublicDigest` swallows DB errors to an empty board, so this is safe even if the DB is down.
- Implementation: `src/components/landing/`
  - `landing.tsx` (client — needs `useAuth` to bounce authed users to `/launchpad`). Sections: `TopNav` (logo + single Sign-up CTA), `Hero` (live count-up eyebrow via `useCountUp`, serif headline, dominant primary + subordinate `/today` link, inline `LiveBoard`), `Pricing` (Founders / Premium), `FinalCTA`, `Footer`.
  - `LiveBoard` — the **only** preview element: top 3 real ranked stories (`PublicStory`) as editorial rows (domain/signal chips, sentiment dot, source · time), with an honest "board is compiling" empty state. Reuses `/today`'s `prettify` / `sentimentColor` / Sydney-time helpers (ported locally so they render through the scoped palette, not `design-tokens.ts`).
  - `landing.css` — scoped palette + typography + layout (every selector under `.cp-launchpad`).

## Pricing (framed, not transactional)

Two tiers, persuasion by structural contrast — no checkout:
- **Founders** — the current, **free** early-access tier; white, lifted, badged, Heroicons green-checked feature list mirroring what the live product ships, full-width "Sign up now" → `/login`.
- **Premium** — a **future** tier, deliberately greyed out and genuinely inert: `.cp-tier--soon` (opacity `0.55` + `grayscale(0.35)` + `pointer-events:none`), a real `<button disabled>` (never an `<a>`), "Coming soon" / "Pricing TBC", a visually-hidden "not yet available" for screen readers. Feature copy is aspirational (premium sources, proprietary-KB research, individually-customised daily podcast, premium fortnightly podcast + newsletter).

When Premium becomes real, swap `.cp-tier--soon` off the card and wire the `<button>` to a real destination.

## Motion

Dynamic-but-simple, all routed through the existing `@media (prefers-reduced-motion: reduce)` block: staggered `cp-rise` entrance, an rAF count-up on the live `signalsTracked` number (`useCountUp`; snaps to the final value under reduced motion; seeds state to the real number so SSR matches and there's no hydration mismatch), the signature `.cp-pulse-dot`, and hover micro-feedback reserved to the primary button.

## Removed in the 2026-06-07 simplification

The 3-pillar segmented switch, the dark founder "moat" section, the "Student login" affordance, all scroll-to-CTA plumbing, and `sample-modal.tsx` + `pulse-art.tsx` (both deleted as dead/unstyled code).

## Design system (scoped)

Warm paper `#F5EFE6` + aubergine ink + forest green. Fonts loaded via `next/font`:
- Inter Tight (sans)
- Newsreader (serif)
- JetBrains Mono (mono)

**Every selector in `landing.css` is namespaced under a `.cp-landing` wrapper**, including CSS variables. A stray unprefixed rule would override shadcn tokens globally across the authed app. Do not remove the namespace.

## Returning-user redirect

1. On successful Supabase magic-link sign-in, `/auth/callback/route.ts` sets `cp_returning=1` (1-year, `lax`, NOT `httpOnly`) and redirects to `/launchpad`
2. Landing reads the cookie via `next/headers` and issues `redirect('/launchpad')` server-side before rendering
3. The cookie **survives logout intentionally** — a returning user should hit `/login` on their next visit, not the marketing page
4. PWA `manifest.json` `start_url: /dashboard` so installed users skip landing entirely (manifest unchanged in this branch)

DO NOT remove the `cp_returning` cookie from `/auth/callback` or change the PWA `start_url` — both are load-bearing for this redirect.

## Cookie consent

`src/components/cookie-consent.tsx` renders in the authed `(app)/layout.tsx`, not landing. It's a transparency notice for `cp_returning` + product analytics. Choice persisted to `localStorage`. It's a notice, not a gate — no server code reads the consent value.
