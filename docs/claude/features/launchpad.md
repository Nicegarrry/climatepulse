# Launchpad (`/launchpad`)

Post-login dashboard triptych that all authenticated users see first. Replaces `/dashboard` as the front door. Lets users route themselves to the right surface (digest, AutoMACC, learning, services) without forcing onboarding or per-user digest generation up front.

## Structure

- Entry: `src/app/(app)/launchpad/page.tsx` (server component)
- Components: `src/components/launchpad/`
  - `data.ts` — six server data fetchers (profile, briefing existence, weekly, NEM, newsroom count, ingest count). Each swallows errors and falls back to `null` / sample data so a failed query never blocks render.
  - `primitives.tsx` — `PulseDot`, `MonoEyebrow`, `Arrow`, `MiniSpark`, `Row`
  - `live-tile.tsx` — 5-state NEM tile with sparklines + sample stamp when the live feed isn't available
  - `weekly-tile.tsx` — Weekly Pulse hero (rendered only when a published edition exists)
  - `macc-tile.tsx` — static AutoMACC sample bars; click goes to `/automacc`
  - `launchpad.css` — scoped design system (`.lp-launchpad`)

## Why it exists

Before 2026-05-14 every authed user landed on `/dashboard` which auto-fired digest generation, energy / weekly / podcast fetches, and forced onboarding before any feature was reachable. That made every fresh signup an expensive cold-start AND coupled AutoMACC access to a successful digest run. The launchpad decouples them:

- Users who only want AutoMACC click the tile in column 3 → straight to `/automacc`. No Gemini call, no digest cron impact, no required onboarding.
- Users who want the briefing click "Today's briefing" in column 1. If they haven't onboarded, the briefing tab renders a "Personalise my briefing" opt-in card (in `src/components/intelligence/index.tsx`) that routes to `/onboarding`. **Digest generation never auto-fires for users with `onboarded_at IS NULL`.**
- The daily digest cron (`step4Digest` in `src/lib/pipeline/steps.ts`) and the weekly Pulse cron (`api/analytics/weekly-pulse/generate`) both filter to `onboarded_at IS NOT NULL AND COALESCE(array_length(primary_sectors, 1), 0) > 0` — so un-onboarded users never enter the per-user fan-out loop.

## Layout

Three columns, top-aligned:

1. **Live intelligence** — hero NEM tile + rows for Today's briefing, Newsroom, Markets. Footer: "Go to live intelligence → /dashboard".
2. **Learning** — hero Weekly Pulse tile (when published) + rows for Learn, Research, Teaching. Footer: "Go to learning → /learn".
3. **Beyond the briefing** — hero AutoMACC sample-bars tile + rows for Private briefings, Sector deep reads, Workshops. Footer: "Talk to us → /services".

Greeting strip above the grid: "Good morning, {firstName}. Three things to read, two things to do." plus live time stamp, today's date, and overnight ingest count.

## Missing-data behaviour

- NEM live feed unavailable → renders a sample snapshot with a "sample · open live →" stamp; click always opens `/dashboard?tab=energy`.
- No published Weekly edition → hero tile hidden, learning rows still render.
- `daily_briefings` row absent for today → "Today's briefing" row says `PERSONALISE`. (If user is un-onboarded, clicking that row leads to the opt-in card.)
- Ingest count zero / errored → both the greeting line and the footer line for ingest are omitted.

## Routing rules

- `cp_returning=1` cookie on `/` → server-side redirect to `/launchpad` (in `src/app/page.tsx`).
- Magic-link callback → `/launchpad` (in `src/app/auth/callback/route.ts`).
- Post-OTP-verify in the login UI → `router.push("/launchpad")` (in `src/app/login/page.tsx`).
- Unauthed visit to `/launchpad` → server-side `redirect("/login")`.

The launchpad itself does NOT auto-redirect users anywhere — it's a router page and everything is a click.
