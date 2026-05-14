# Auth & RBAC

## Supabase magic links

- `signInWithOtp` in `src/lib/auth-context.tsx`
- Login UI in `src/app/login/page.tsx`
- Magic-link exchange at `src/app/auth/callback/route.ts`
- Server-side gating via `requireAuth()` in `src/lib/supabase/server.ts`

Never reintroduce hardcoded test users. Auth is real.

## Roles

Stored on the user record, read as `user.role`:

- `reader` — default tier; sees Briefing, Learn, Newsroom, Energy, Markets, Weekly
- `editor` — adds Editor, Flagship tabs
- `admin` — adds Discovery, Categories, Taxonomy, Podcast (admin) tabs

Role gating lives in `getTabsForRole()` in `src/app/(app)/dashboard/page.tsx`. Mobile nav is separately role-specific via `getMobileNavForRole()` (3 primary slots + "More"). The old `NEXT_PUBLIC_SHOW_DEV_TABS` env flag is no longer in the codebase — everything is RBAC now.

Guest-editor access is time-windowed via the `editor_assignments` table (see [`../features/editor.md`](../features/editor.md)).

## RLS

RLS must be ON for every Supabase table in prod. Server routes bypass it via `SUPABASE_SERVICE_ROLE_KEY`; client code uses the anon key.

## Post-auth routing

All authenticated users land on **`/launchpad`** (server component at `src/app/(app)/launchpad/page.tsx`) — a dashboard triptych that routes them onward. The launchpad replaces `/dashboard` as the front door:

- New users without `onboarded_at` can go straight to `/automacc` (founder-tier surface) or click "Today's briefing" — the briefing tab renders a "Personalise my briefing" CTA card until they complete `/onboarding`. Digest generation is **opt-in** — it never auto-fires for un-onboarded users.
- Daily digest cron (`step4Digest` in `src/lib/pipeline/steps.ts`) and weekly summary cron only loop over users with `onboarded_at IS NOT NULL AND primary_sectors <> '{}'`.
- Once onboarded, the cron picks the user up automatically on the next run.

See [`../features/launchpad.md`](../features/launchpad.md).

## `cp_returning` cookie

- Set in `/auth/callback` on successful sign-in
- 1-year, `lax`, NOT `httpOnly` (the landing page reads it server-side via `next/headers`)
- Landing (`src/app/page.tsx`) reads it and issues `redirect('/launchpad')` before any HTML renders — returning users never see the marketing page
- **Cookie survives logout intentionally** — a returning user should hit `/login` on their next visit, not the marketing landing
- PWA `manifest.json` `start_url: /dashboard` so installed users skip landing entirely (separate config file; not changed in this branch — see `public/manifest.json`)

DO NOT remove this cookie from `/auth/callback` — the redirect depends on it.

## Cookie consent

`src/components/cookie-consent.tsx` renders in the authed `(app)/layout.tsx`. Transparency notice for `cp_returning` + product analytics; accept / essential-only choice persisted to `localStorage`. It's a notice, not a gate — no server code reads the consent value.
