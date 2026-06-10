---
name: climate-digest
description: >-
  Generate a personalised daily climate / energy / sustainability intelligence
  digest into a local Markdown wiki. Fetches configured RSS sources
  deterministically, dedups, then scores + tags each article and synthesises a
  dated briefing plus structured per-article records. Runs a one-time onboarding
  to tailor sources, and self-tunes from feedback over time. Use when the user
  asks to run the daily climate digest / morning brief, set it up, or invokes
  "/climate-digest".
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, AskUserQuestion
---

# climate-digest

A single-user replica of the ClimatePulse daily pipeline, collapsed into one
skill. It produces a morning intelligence digest over climate / energy /
sustainability news and stores it as a local Markdown wiki — **no database, no
vectors**.

## Operating philosophy (read first)

Three principles, lifted from the production system:

1. **Do deterministic work deterministically.** RSS fetch, dedup, and full-text
   extraction happen in Python (`scripts/`), never by the model. The LLM (you)
   is reserved for the two jobs only it can do: **tag/score** and **synthesise**.
2. **Tag once, query forever.** Every kept article is written as a structured
   record (`wiki/articles/.../<slug>.md` with YAML frontmatter). That record's
   shape is the canonical schema (`docs/SCHEMA.md`) — it is deliberately the
   future "datalake row", so this version upgrades into the shared/crowdsourced
   pool without a rewrite.
3. **Append-only.** Dated digests and article records are immutable once written.
   `index.md` is regenerated; `state/learning.md` is appended to. Never rewrite
   history — that keeps the door open to a shared append-only pool later.

## Layout

```
.claude/skills/climate-digest/
├── SKILL.md              ← this runbook
├── onboarding.md         ← first-run-only sub-prompt (tailors sources)
├── config/
│   ├── feeds.default.yaml ← shipped sources (never edited by hand after onboarding)
│   ├── feeds.yaml         ← user's tailored sources (created by onboarding; takes precedence)
│   └── taxonomy.yaml      ← editable domains + signal types
├── scripts/
│   ├── fetch_feeds.py     ← collect + dedup → state/new_items.json
│   ├── commit_seen.py     ← mark processed items seen (run only after success)
│   └── requirements.txt
├── docs/SCHEMA.md        ← the per-article record schema (= future lake row)
├── state/                ← memory: profile, learning, source stats, seen ledger
└── wiki/                 ← the product: digests/ + articles/ + index.md
```

## Step 0 — Onboarding gate (first run only)

If `state/profile.md` does **not** exist, this is a first run:

1. Read `onboarding.md` and run that flow to completion. It interviews the user
   (role/lens, sectors, jurisdictions, languages, sources, digest length),
   writes `state/profile.md`, and produces a tailored `config/feeds.yaml`.
2. Then continue to Step 1.

> Onboarding is **interactive** — run it once, by hand. Daily/headless runs
> assume `state/profile.md` already exists and skip Step 0.

## Step 1 — Load memory

Read, in order (skip any that don't exist yet):
- `state/profile.md` — who this digest is for; interests, jurisdictions, lens.
- `state/learning.md` — last ~10 reflection entries (recent tuning lessons).
- `state/feedback.md` — any unprocessed user notes since last run.
- `state/source_stats.json` — per-source yield history.

If `state/feedback.md` has new content: reconcile it into `state/profile.md`
(adjust interests/sources), record what changed in `state/learning.md`, then
clear `feedback.md` (truncate to an empty `# Feedback` header).

## Step 2 — Collect (deterministic)

```
python3 scripts/fetch_feeds.py --fulltext
```

This reads `config/feeds.yaml` (or `feeds.default.yaml`), drops anything already
in `state/seen.json`, applies the age cutoff, and writes new items to
`state/new_items.json`. It does **not** mark items seen yet.

If `--fulltext` errors (trafilatura missing), rerun without it — RSS summaries
are an acceptable fallback.

## Step 3 — Tag + score (LLM)

Read `state/new_items.json` and `config/taxonomy.yaml`. For each item assign:
- `domain` (one of the taxonomy domains)
- `signal_type` (one of the taxonomy signal types)
- `sentiment` (positive | neutral | negative)
- `jurisdictions` (ISO-ish codes/names; `[]` if none)
- `entities` (`[{name, type}]`; companies, people, policies, projects, tech)
- `significance` (0–100) — weight by novelty, scale of impact, credibility of
  source, and **relevance to `profile.md`** (boost the user's sectors and
  jurisdictions; demote off-interest noise). Lean on `source_stats` and recent
  `learning.md` lessons (e.g. a chronically low-yield source gets a higher bar).
- `why_it_matters` (one sentence)

Keep only items scoring **≥ the significance floor** in `profile.md`
(default 55), then cap at the **top 15** by score — same cap the production
digest uses; more does not improve quality.

## Step 4 — Write article records (append-only)

For each kept item, write `wiki/articles/<YYYY>/<YYYY-MM-DD>/<slug>.md` using the
frontmatter schema in `docs/SCHEMA.md`. `<slug>` = a short kebab-case from the
title. Never overwrite an existing record.

## Step 5 — Synthesise the digest (LLM)

Write `wiki/digests/<YYYY-MM-DD>.md` with:
- **Daily Number** — one quantitative anchor pulled from today's stories.
- **Narrative** — a short opening paragraph tying the day together.
- **Hero stories** (2–4) — fuller treatment; link to their article records.
- **Compact list** — one-liners for the rest, each linking its record.
- **Connections** — any callout where two stories interact.

Match the depth to the `digest_length` preference in `profile.md`.

## Step 6 — Update the index

Regenerate `wiki/index.md`: newest digests first (date + Daily Number + hero
headlines as links). This file is the wiki home page.

## Step 6b — Static dashboard (on demand)

When the user asks to "see the dashboard" / "build the dashboard" (or always, if
they've opted into it), render a simpler echo of the ClimatePulse dashboard:

```
python3 scripts/build_dashboard.py
```

This reads the wiki and emits a single self-contained `wiki/dashboard.html`
(Briefing / Newsroom / Archive tabs, domain filter chips, significance gutter) —
no server, no build step. Tell the user the path; they open it in a browser, or
serve the folder with `python3 -m http.server`. It is a generated artifact
(git-ignored) — rebuild any time.

## Step 7 — Commit memory + close the loop

1. Update `state/source_stats.json`: for each source, record today's
   `fetched` / `kept` counts (rolling).
2. Append a dated reflection to `state/learning.md`: what dominated, which
   sources over/under-delivered, any source the data suggests adding or
   retiring, and what you tuned. Keep it to a few bullets. This is the
   **self-learning memory** — next run reads it back in Step 1.
3. Mark items processed: `python3 scripts/commit_seen.py`
4. If this is a git-backed deployment (a Routine / scheduled run): stage and
   commit `state/` and `wiki/` and push, so the next run starts from today's
   state. (The remote run environment is ephemeral — uncommitted state is lost.)

## Self-learning, concretely

The system improves without any DB through four files:

| File | Role | Cadence |
|---|---|---|
| `state/profile.md` | who/what the digest serves | edited on onboarding + when feedback warrants |
| `state/feedback.md` | user's quick notes ("more policy, less PR") | user writes; skill consumes + clears each run |
| `state/source_stats.json` | per-source yield history | skill updates every run |
| `state/learning.md` | append-only reflection journal | skill appends every run; reads recent entries back |

Tuning is conservative: low-risk changes (raising a noisy source's bar,
nudging significance weights) are applied automatically and noted in
`learning.md`. Bigger changes (adding/removing whole sources) are **proposed**
in the reflection and only applied during an interactive run where the user can
confirm — never silently in a headless run.

## Forward-compatibility (toward the shared pool)

Keep these invariants so this skill upgrades cleanly into the future append-only
crowdsourced lake:
- Article records carry `schema_version` and a stable `id` (sha1 of canonical
  URL). Don't change the id derivation.
- Records are immutable and dated; digests are immutable.
- Dedup is by URL id **and** title hash (see `scripts/`). Keep both.
- Nothing here assumes a single user's sources — `feeds.yaml` is just *this*
  user's slice; the schema is identical to what a pool would store.
