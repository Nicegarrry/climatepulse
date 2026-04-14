# Events Tab — Design Spec

## Context

ClimatePulse has five active dashboard tabs but the Events tab is a disabled placeholder. The vision: scrape structured event platforms to build a personalised calendar of climate/energy events localised to the user's interests and location. Users see a prioritised timeline of what to attend — investor pitches, industry meetups, policy hearings, workshops — ranked by their onboarding preferences (role lens, sectors, jurisdictions).

This mirrors the proven article pipeline pattern: **ingest → classify → personalise → display**.

## Decision Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Event types | All (professional, community, investor, etc.) | Group and rank via existing onboarding preferences |
| Data sources | Structured APIs first | Clean data, proper dates/locations. Scrapers added later |
| Geography | Australia-first | Match user jurisdiction preferences. Major global events secondary |
| UI model | Horizontal timeline | Cards by date, visual clustering. Not calendar grid |
| Taxonomy | Reuse existing 12 domains / 108 microsectors | Zero extra user config — onboarding sectors auto-apply |
| AI enrichment | Lightweight Gemini Flash classification | Domain + microsector tagging from title+description. No significance scoring |
| Architecture | Parallel pipeline (Approach A) | Mirror article pipeline. Separate tables, shared taxonomy + personalisation |

---

## 1. Data Model

### `events` table (raw ingestion)

```sql
CREATE TABLE events (
  id              SERIAL PRIMARY KEY,
  source_platform TEXT NOT NULL,          -- 'eventbrite', 'luma', 'meetup', 'humanitix'
  external_id     TEXT NOT NULL,          -- Platform's event ID
  title           TEXT NOT NULL,
  description     TEXT,                   -- Full description from API
  start_at        TIMESTAMPTZ NOT NULL,   -- Event start
  end_at          TIMESTAMPTZ,            -- Event end (nullable)
  location_name   TEXT,                   -- Venue name
  location_city   TEXT,                   -- City
  location_state  TEXT,                   -- AU state code or country
  location_lat    NUMERIC,               -- Latitude (if available)
  location_lng    NUMERIC,               -- Longitude (if available)
  is_online       BOOLEAN DEFAULT false,
  organiser_name  TEXT,
  organiser_url   TEXT,
  url             TEXT NOT NULL,          -- Link to event page
  image_url       TEXT,                   -- Banner/thumbnail
  price_text      TEXT,                   -- "Free", "$50", "From $120"
  price_cents     INTEGER,               -- Parsed numeric (nullable)
  event_type      TEXT DEFAULT 'other',   -- conference, meetup, webinar, workshop, pitch_day, hearing, summit, other
  tags            TEXT[],                 -- Raw tags from API
  ingested_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_platform, external_id)
);

CREATE INDEX idx_events_start_at ON events(start_at);
CREATE INDEX idx_events_location_state ON events(location_state);
```

### `classified_events` table (enrichment output)

```sql
CREATE TABLE classified_events (
  id              SERIAL PRIMARY KEY,
  event_id        INTEGER NOT NULL REFERENCES events(id),
  domain_ids      INTEGER[],             -- From Gemini classification
  microsector_ids INTEGER[],             -- From Gemini classification
  jurisdictions   TEXT[],                -- Derived from location + AI
  classified_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id)
);

CREATE INDEX idx_classified_events_domains ON classified_events USING GIN(domain_ids);
CREATE INDEX idx_classified_events_microsectors ON classified_events USING GIN(microsector_ids);
```

### Jurisdiction auto-mapping

`location_state` maps directly to user jurisdiction preferences:
- `NSW` → `nsw`, `VIC` → `vic`, `QLD` → `qld`, etc.
- Online events: tagged with broader jurisdictions based on organiser location
- International events: mapped to `eu`, `us`, etc. if they appear

---

## 2. Ingestion Pipeline

### API Clients

Four structured API clients, each in `src/lib/events/`:

| Platform | File | API Type | Strengths |
|----------|------|----------|-----------|
| Eventbrite | `eventbrite-client.ts` | REST API | Conferences, paid events, strong AU presence |
| Luma | `luma-client.ts` | REST API | Tech/startup/investor events |
| Meetup | `meetup-client.ts` | GraphQL API | Community groups, grassroots |
| Humanitix | `humanitix-client.ts` | REST/scrape | AU-native, not-for-profit events |

### Search Strategy

~20 keyword groups derived from taxonomy domains:

```
"clean energy", "renewable energy", "solar", "wind energy",
"climate change", "sustainability", "carbon emissions", "net zero",
"electric vehicle", "battery storage", "green hydrogen",
"ESG investing", "climate finance", "carbon market",
"energy policy", "climate adaptation", "critical minerals",
"circular economy", "green building", "biodiversity"
```

Location filter: `Australia` (or AU state codes where API supports it).

### Scheduling

- **Daily cron**: Run alongside the article pipeline (19:00 UTC / 05:00 AEST)
- **On-demand**: Trigger from dev panel (like existing enrichment)
- **API route**: `POST /api/events/ingest`

### Dedup

- **Within-platform**: `UNIQUE(source_platform, external_id)` — upsert on conflict
- **Cross-platform**: Deferred. Future: fuzzy match on title + start_at within 1 hour window

### Lifecycle

- All read queries filter `WHERE start_at > NOW()` — past events excluded from timeline
- Past events retained in DB for analytics
- Optional future: archive events older than 90 days

---

## 3. Classification

Single-stage Gemini Flash classification (simpler than the 2-stage article pipeline):

- **Batch size**: 10 events per API call
- **Input**: title + first 500 chars of description
- **Output per event**: `domain_ids[]` (1-2), `microsector_ids[]` (1-3)
- **Prompt template**: `prompts/event-classifier-system.md`
  - References existing `definitions/domains.md` and `definitions/micro-sectors.md`
  - Uses `prompt-loader.ts` pattern
- **Cost**: ~$0.01/day for 50 events
- **Trigger**: Runs automatically after ingestion completes
- **API route**: `POST /api/events/classify`

Jurisdiction is derived automatically from `location_state` — no AI needed for AU events.

---

## 4. Personalisation & Ranking

Adapt `computePersonalScore()` from `src/lib/personalisation.ts`:

### Scoring Formula

**Base score**: 50 (all events start equal)

**Boosts**:
| Condition | Boost | Notes |
|-----------|-------|-------|
| Microsector matches `primary_sectors` | +25 | Direct sector interest |
| Domain matches user's sectors (broader) | +20 | Domain-level affinity |
| Jurisdiction matches user's `jurisdictions` | +15 | Geographic relevance |
| Organiser matches `followed_entities` | +15 | Known organiser |
| Event type matches role lens affinity | +10 | Role-appropriate events |
| No sector or jurisdiction overlap | -10 | Penalise irrelevant |

**Boost cap**: 35. **Floor**: -10. (Same as article personalisation.)

### Role → Event Type Affinity

| Role | Boosted event types |
|------|-------------------|
| investor | pitch_day, summit, conference |
| corporate_sustainability | workshop, conference, webinar |
| policy_analyst | hearing, roundtable, summit |
| project_developer | workshop, conference, meetup |
| board_director | summit, conference, pitch_day |
| researcher | conference, webinar, workshop |
| general | (no type boost) |

### Sort Order

1. Primary: `personal_score` descending (most relevant first)
2. Secondary: `start_at` ascending (sooner events first among equal scores)

### API

- `GET /api/events?userId=...` — returns upcoming classified events with personal scores
- Pagination via cursor on `start_at`

---

## 5. Timeline UI

### Component: `src/components/events-tab.tsx`

Horizontal scrollable timeline with date-clustered columns:

### Layout

```
[Filters: Domain chips | Event type | Free only | Online]
─────────────────────────────────────────────────────────
│ TODAY    │ THIS WEEK │ NEXT WEEK │ THIS MONTH │ LATER │
│          │           │           │            │       │
│ [card]   │ [card]    │ [card]    │ [card]     │ [card]│
│ [card]   │ [card]    │ [card]    │            │       │
│          │ [card]    │           │            │       │
─────────────────────────────────────────────────────────
                    ← scroll →
```

### Event Card

```
┌─────────────────────────────────┐
│ ▌ Conference Title Here         │  ← Domain colour left border
│   📅 Wed 16 Apr · 9:00 AM      │
│   📍 Sydney Convention Centre   │
│   🏷️ Energy — Generation        │
│   👤 Clean Energy Council       │
│   [Free] [Conference]           │  ← Badges
└─────────────────────────────────┘
```

- Domain colour band on left border (reuse existing `domainColorMap`)
- Event type as badge (same style as signal type badges in Intelligence tab)
- Price badge: green for "Free", neutral for paid
- Click → slide-over detail panel with full description + "Open in [Platform]" CTA

### Filters

- **Domain chips**: Reuse domain colour pills from Categories tab
- **Event type**: Dropdown or chip group (conference, meetup, webinar, etc.)
- **Free only**: Toggle
- **Online**: Toggle
- Filters are client-side on the already-fetched + scored event list

### Empty State

"No events found matching your interests. Try broadening your sectors in Settings."

---

## 6. File Structure

```
src/
├── lib/
│   └── events/
│       ├── eventbrite-client.ts    # Eventbrite API client
│       ├── luma-client.ts          # Luma API client
│       ├── meetup-client.ts        # Meetup GraphQL client
│       ├── humanitix-client.ts     # Humanitix client
│       ├── event-classifier.ts     # Gemini Flash classification
│       └── event-personalise.ts    # Score events against user profile
├── app/
│   └── api/
│       └── events/
│           ├── ingest/route.ts     # POST — run ingestion from all sources
│           ├── classify/route.ts   # POST — classify unclassified events
│           └── route.ts            # GET — fetch personalised events
├── components/
│   └── events-tab.tsx              # Timeline UI
scripts/
└── migrate-events.sql              # events + classified_events tables
prompts/
└── event-classifier-system.md      # Classification prompt template
```

---

## 7. Verification Plan

### Manual Testing

1. **Ingestion**: Run `POST /api/events/ingest` from dev panel, verify events appear in DB with correct fields
2. **Dedup**: Run ingestion twice, confirm no duplicates (check `UNIQUE` constraint)
3. **Classification**: Run `POST /api/events/classify`, verify `classified_events` rows with sensible domain/microsector tags
4. **Personalisation**: Fetch `GET /api/events?userId=test` with known profile, confirm ranking order matches expectations (sector-matched events score higher)
5. **Timeline UI**: Open Events tab, verify horizontal scroll, date clustering, card rendering, filter interactions
6. **Lifecycle**: Add a past event manually, confirm it's excluded from timeline query
7. **Empty state**: Test with a user whose sectors don't match any events

### Dev Panel Integration

- Add "Ingest Events" and "Classify Events" buttons to dev panel (same pattern as existing enrichment buttons)
- Show ingestion stats: events found per platform, new vs skipped, classification results
