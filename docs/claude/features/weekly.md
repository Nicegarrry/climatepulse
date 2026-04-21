# Weekly Pulse (Phase 4)

Weekly editorial digest — auto-generated intelligence report reviewed and curated by a human editor, then published across email, LinkedIn, and the Intelligence tab.

## Cadence

- **Fri 15:00** — auto-generate intelligence report from the week's enriched articles
- **Sat 06:00** — editor briefing pack written to `weekly_reports` for editor review
- Editor curates stories + writes commentary + publishes on their own schedule

## Report generation

- Theme clustering via taxonomy overlap (group by domain + shared entities + microsectors) — `src/lib/weekly/theme-clusterer.ts`
- Gemini Flash refines cluster labels (~$0.01/week)
- Output: theme clusters, sentiment distribution, headline numbers
- Stored in `weekly_reports`

Total cost target: ~$0.03/week.

## Editor workflow

Lives in the Editor tab (`src/components/editor/`). Features:

- Review generated report
- Write editorial commentary (markdown)
- Curate story roundup
- Set headline + narrative
- Byline + scheduled send
- Publish triggers:
  - Email blast via Resend (`src/lib/weekly/email-sender.ts`)
  - 48h banner on the Intelligence tab (`src/components/weekly/banner.tsx`)
  - LinkedIn draft

Curated digests are stored in `weekly_digests` (headline, narrative, curated stories, distribution tracking).

## Reader surface

Weekly tab (`src/components/weekly/`):
- `index.tsx` — main layout + data fetching
- `current-digest.tsx` — reading view
- `digest-archive.tsx` — past editions list
- `weekly-number.tsx` — Number of the Week card
- `banner.tsx` — time-limited Intelligence-tab banner

## Editor-adjacent features

Deeper editor dashboard detail (assignments, briefing regenerate endpoint, source-health widget, etc.) lives in [`editor.md`](editor.md).
