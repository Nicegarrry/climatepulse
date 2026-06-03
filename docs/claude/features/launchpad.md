# Launchpad (`/launchpad`)

Post-login dashboard triptych that all authenticated users see first. Replaces `/dashboard` as the front door. Lets users route themselves to the right surface (digest, AutoMACC, learning, services) without forcing onboarding or per-user digest generation up front.

## Structure

- Entry: `src/app/(app)/launchpad/page.tsx` (server component)
- Components: `src/components/launchpad/`
  - `data.ts` — server data fetchers (profile, briefing existence, NEM duck curve, newsroom count, ingest count). Each swallows errors and falls back to `null` / sample data so a failed query never blocks render.
  - `primitives.tsx` — `PulseDot`, `MonoEyebrow`, `Arrow`, `MiniSpark`, `Row`
  - `duck-curve-tile.tsx` — compact NEM intraday snippet: a stacked generation-by-fueltech area chart with the spot-price line overlaid + a fuel legend (a snippet of the `/dashboard?tab=energy` chart). Sourced from `getDuckCurve()`, which reads the `intraday` block of `fetchEnergyDashboard()` (the same call the app already makes) and falls back to a deterministic 24h sample.
  - `macc-tile.tsx` — static AutoMACC sample bars; click goes to `/automacc`
  - `launchpad.css` — scoped design system (`.lp-launchpad`)

**Trimmed (2026-06-03):** the page was cut to just the surfaces that work today. Removed the three-column triptych (Weekly/Research/Teaching/Services) and the `weekly-tile.tsx` + `getLatestWeekly` data fetcher. The `Row` primitive is retained for potential reuse but no longer rendered.

## Why it exists

Before 2026-05-14 every authed user landed on `/dashboard` which auto-fired digest generation, energy / weekly / podcast fetches, and forced onboarding before any feature was reachable. That made every fresh signup an expensive cold-start AND coupled AutoMACC access to a successful digest run. The launchpad decouples them:

- Users who only want AutoMACC click the tile in column 3 → straight to `/automacc`. No Gemini call, no digest cron impact, no required onboarding.
- Users who want the briefing click "Today's briefing" in column 1. If they haven't onboarded, the briefing tab renders a "Personalise my briefing" opt-in card (in `src/components/intelligence/index.tsx`) that routes to `/onboarding`. **Digest generation never auto-fires for users with `onboarded_at IS NULL`.**
- The daily digest cron (`step4Digest` in `src/lib/pipeline/steps.ts`) and the weekly Pulse cron (`api/analytics/weekly-pulse/generate`) both filter to `onboarded_at IS NOT NULL AND COALESCE(array_length(primary_sectors, 1), 0) > 0` — so un-onboarded users never enter the per-user fan-out loop.

## Layout

Greeting strip, then a hero + a 3-tile row:

1. **Hero — Today's briefing (the dashboard).** Big card; CTA "Open the dashboard → `/dashboard?tab=intelligence`". `READY · 5 MIN` when a `daily_briefings` row exists for today, else `PERSONALISE`. Two small sub-component cards sit alongside it (the surfaces that feed the briefing):
   - **Newsroom** — live wire-item count (24h) → `/dashboard?tab=newsroom`
   - **Markets** — ASX movers → `/dashboard?tab=markets`
2. **Tile row** (`.lp-tiles`, 3 columns):
   - **02 · Energy · NEM** — `DuckCurveTile` (intraday generation stack + spot-price line) → `/dashboard?tab=energy`
   - **03 · Decarbonisation** — `MaccTile` → `/automacc`
   - **04 · Learn** — greyed, non-interactive "Coming soon" tile (no link)

Greeting strip: "Good morning, {firstName}. Here's your climate desk." plus live time stamp, today's date, and overnight ingest count.

## Missing-data behaviour

- NEM intraday feed unavailable → the duck-curve tile renders a deterministic sample curve with a "sample · open live →" stamp; click always opens `/dashboard?tab=energy`.
- `daily_briefings` row absent for today → hero status reads `PERSONALISE`. (If user is un-onboarded, opening the dashboard leads to the opt-in card.)
- Newsroom count errored → the sub-card figure shows `—`.
- Ingest count zero / errored → both the greeting line and the footer line for ingest are omitted.

## Routing rules

- `cp_returning=1` cookie on `/` → server-side redirect to `/launchpad` (in `src/app/page.tsx`).
- Magic-link callback → `/launchpad` (in `src/app/auth/callback/route.ts`).
- Post-OTP-verify in the login UI → `router.push("/launchpad")` (in `src/app/login/page.tsx`).
- Unauthed visit to `/launchpad` → server-side `redirect("/login")`.

The launchpad itself does NOT auto-redirect users anywhere — it's a router page and everything is a click.
