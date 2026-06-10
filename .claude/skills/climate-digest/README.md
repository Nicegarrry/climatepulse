# climate-digest

A single-user Claude skill that replicates the ClimatePulse daily pipeline in
miniature: fetch climate/energy/sustainability news → tag & score → synthesise a
morning briefing → store it as a local Markdown wiki. **No database, no vectors.**

It is built so the per-article records (`docs/SCHEMA.md`) are the same shape a
future shared/crowdsourced pool would store — so v1 upgrades without a rewrite.

## Install

```bash
pip install -r .claude/skills/climate-digest/scripts/requirements.txt
```

(`trafilatura` is optional — without it the fetch falls back to RSS summaries.)

## First run — onboarding (interactive, once)

In Claude Code:

```
/climate-digest
```

With no `state/profile.md` present, the skill runs `onboarding.md`: a short
interview that tailors your sources into `config/feeds.yaml` and writes your
profile. This is the only step that needs a human.

## Daily run

```
/climate-digest
```

It collects new items, scores them against your profile, writes the day's
briefing to `wiki/digests/<date>.md` and structured records to
`wiki/articles/...`, updates `wiki/index.md`, and appends a learning reflection.

## Static dashboard (on demand)

A simpler echo of the ClimatePulse dashboard — Briefing / Newsroom / Archive
tabs, domain filtering — as one self-contained HTML file:

```bash
python3 .claude/skills/climate-digest/scripts/build_dashboard.py
# open .claude/skills/climate-digest/wiki/dashboard.html
```

## Sources & validation

- **Starter list:** `config/feeds.default.yaml` — ~14 curated, keyless RSS feeds
  spanning policy/science, energy verticals, transport, and US/EU/AU/Asia, with
  a `core` subset onboarding always keeps so the digest is never empty.
- **Your list:** onboarding writes `config/feeds.yaml`, which takes precedence.
- **Adding a source** (onboarding, a note in `state/feedback.md`, or a
  skill proposal) always passes through the validator first:

  ```bash
  python3 scripts/validate_feeds.py <feed-url>        # test a feed
  python3 scripts/validate_feeds.py --discover <site> # find a site's feed
  python3 scripts/validate_feeds.py --all             # health-check the active list
  ```

  Only `ok`/`stale` feeds get written; `blocked`/`unreachable`/`no-feed-found`
  are reported, not added.

### ⚠️ Network note

Feeds need outbound HTTPS to the publishers. Two things commonly block this and
make *every* feed return HTTP 403 (`status: blocked`):

1. **Publisher bot-protection** — mitigated by the realistic User-Agent the
   scripts already send; some CDNs still block datacenter IPs.
2. **A run-environment network allowlist** — e.g. this Claude Code web sandbox
   only permits a few hosts, so no news feed is reachable here at all.

A **local run** (residential IP) is the most permissive. For a **cloud
Routine/CI**, widen the network policy to allow the news domains, or run it
locally. Sanity-check with one `validate_feeds.py <known-good-url>` before
suspecting the source list.

## Schedule it (pick one)

- **Claude Code Routine (web)** — attach a daily schedule trigger to this repo;
  runs unattended on Anthropic infra, survives reboots. Easiest.
- **GitHub Actions** — a `schedule:` workflow running `claude -p "/climate-digest"`,
  committing the wiki. Free managed cron.
- **System cron / launchd** — `claude -p "/climate-digest"` each morning.

`/loop` is *not* suitable — it only runs while a session stays open.

## How the self-learning works

Four files in `state/`, all plain text/JSON:

- `profile.md` — who the digest serves (set at onboarding, evolves with feedback)
- `feedback.md` — drop quick notes here anytime ("more policy, less PR"); the
  skill consumes and clears them each run
- `source_stats.json` — per-source yield history, updated every run
- `learning.md` — append-only reflection journal the skill reads back each run

Conservative tuning is automatic; structural changes (adding/removing sources)
are proposed and confirmed in an interactive run.

## Roadmap (kept in mind by design)

1. **Now** — per-user skill → local Markdown wiki + on-demand dashboard.
2. **Next** — point the same records at a shared, public, **append-only** pool
   (option A): each user contributes their source slice, everyone reads free.
   The schema and dedup keys here are already pool-ready.
3. **Later** — coordinator + consensus for trustless federated compute (option B).

See the repo's CLAUDE.md and `docs/claude/` for the production system this mirrors.
