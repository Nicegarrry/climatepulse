# Marketing Landing (`/`)

Public, server-rendered, SEO-indexable landing page. Returning users are redirected server-side before any HTML renders.

## Structure

- Entry: `src/app/page.tsx` (server component)
- Implementation: `src/components/landing/`
  - `landing.tsx` — composition of all sections (hero, problem, how, features, personas, moat, FAQ, CTA, footer)
  - `landing.css` — scoped palette + typography + layout
  - `pulse-art.tsx` — generative ECG canvas hero (pure canvas, **no p5 dependency**; settles after 180 frames)
  - `sample-modal.tsx` — bottom-sheet sample briefing with live Energy snapshot + ASX ticker strip (positions the product as a data dashboard, not just a newsletter)

## Design system (scoped)

Warm paper `#F5EFE6` + aubergine ink + forest green. Fonts loaded via `next/font`:
- Inter Tight (sans)
- Newsreader (serif)
- JetBrains Mono (mono)

**Every selector in `landing.css` is namespaced under a `.cp-landing` wrapper**, including CSS variables. A stray unprefixed rule would override shadcn tokens globally across the authed app. Do not remove the namespace.

## Returning-user redirect

1. On successful Supabase magic-link sign-in, `/auth/callback/route.ts` sets `cp_returning=1` (1-year, `lax`, NOT `httpOnly`)
2. Landing reads the cookie via `next/headers` and issues `redirect('/dashboard')` server-side before rendering
3. The cookie **survives logout intentionally** — a returning user should hit `/login` on their next visit, not the marketing page
4. PWA `manifest.json` `start_url: /dashboard` so installed users skip landing entirely

DO NOT remove the `cp_returning` cookie from `/auth/callback` or change the PWA `start_url` — both are load-bearing for this redirect.

## Cookie consent

`src/components/cookie-consent.tsx` renders in the authed `(app)/layout.tsx`, not landing. It's a transparency notice for `cp_returning` + product analytics. Choice persisted to `localStorage`. It's a notice, not a gate — no server code reads the consent value.
