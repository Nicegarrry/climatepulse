# Editor Dashboard

Editor + Flagship tabs. Gated to `editor` and `admin` roles by `getTabsForRole()`.

## Features

- **Weekly Pulse workflow** — curate stories, write commentary, publish (see [`weekly.md`](weekly.md))
- **Daily briefing regenerate** endpoint + button on past editions
- **Collapsible sections** with persistent open/closed state across reloads
- **Byline + scheduled sends + markdown upload** for weekly digest
- **4-archetype briefing preview** — lazy preview of all archetype variants from the editor surface
- **Persistent source-health corner widget** — at-a-glance source status without leaving the page
- **Past editions list** shows byline + summary per entry
- **Saturday 06:00 editor briefing pack** auto-generates into `weekly_reports` ahead of editor review

## Guest editor access

Week-based via `editor_assignments`. A guest editor gets scoped permissions for a specific ISO week without needing full `editor` role on their Supabase user record.

Gate logic: `src/lib/auth-context.tsx` + server `requireAuth()` in `src/lib/supabase/server.ts`.

## Flagship tab

Separate tab for the flagship-episode backlog (`flagship_episodes`): `status` enum, `scheduled_for`, sequential `episode_number` on publish, `assigned_characters[]`, `linked_weekly_digest_id`. Component: `src/components/flagship-scheduler.tsx`.

Flagship + themed podcast variants (Workstreams B + C) are on the `podcast` branch; daily-archetype variants (Workstream A) are on `main`.

## Components

- `src/components/editor/` — editor shell + sections
- `src/components/flagship-scheduler.tsx`

## Recent notable commits

- `37637d6` — guest editor week-based access via `editor_assignments`
- `45cccb1` — Sat 06:00 editor briefing pack on `weekly_reports`
- `4ddbecf` — lazy 4-archetype briefing preview
- `6813ba6` — daily briefing regenerate endpoint + button
- `0fd93ef` — persistent source-health corner widget
- `f970c70` — collapsible sections with persistent state
- `2cc42fd` — byline + summary on past editions
