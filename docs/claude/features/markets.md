# Markets

Cron-driven commodity + equity ticker coverage. Reader-facing Markets tab.

## Surfaces

- Price ticker strip
- Sparkline charts
- Recent announcements for tracked equities

## API routes (`/api/markets/`)

- `announcements/`
- `prices/`
- `sparkline/`
- `tickers/`

## Component

- `src/components/markets-tab.tsx`

## Cron

Prices + announcements refresh on a dedicated cron (landed in commit `bc55d9f`). Check `vercel.json` for the current schedule; counts against the Pro cron ceiling.

## Schema

See `scripts/migrate-markets.sql`.
