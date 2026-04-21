# Learn System — Edge Case Decisions

**Status**: Phase 1 draft. Awaiting user review at the Phase 1 checkpoint.
**Sibling docs**: [00-agent-team-plan.md](./00-agent-team-plan.md), [01-schema.md](./01-schema.md)

Each decision here is proposed with a default. The Phase 1 checkpoint is the moment to stress-test them and overturn any that don't match your mental model. Once approved, Phase 2 builds against these assumptions.

---

## 1. Concept card disambiguation

**Problem**: "Capacity" means one thing in electricity markets (MW nameplate of a generator) and another in corporate finance (credit capacity). Same term, different card. Users following a hyperlink from an article could land on the wrong one.

**Decision**:

- `concept_cards` has a `disambiguation_context TEXT NOT NULL DEFAULT ''` column. `UNIQUE (slug, disambiguation_context)`.
- Unambiguous terms: `slug='mlf'`, `disambiguation_context=''` → URL `/learn/concepts/mlf`.
- Ambiguous terms: two rows with `slug='capacity'`, one with `disambiguation_context='markets'`, one with `disambiguation_context='corporate'`. URL `/learn/concepts/capacity` renders a **disambiguation page** (not a table row) listing both; URLs `/learn/concepts/capacity/markets` and `/learn/concepts/capacity/corporate` go straight to the cards.
- Inline tooltips resolve by context: the rendering layer passes the article's primary_domain + microsector_ids, and `<InlineConceptTooltip>` picks the card whose tags overlap most. When no context is available, tooltip links to the disambiguation page instead of a card.
- Promoting an unambiguous card to disambiguated: an editor creates a new card with `disambiguation_context='markets'`, updates the old one's `disambiguation_context='corporate'`, and adds `supersedes` relationships as needed. No schema change required — just two `UPDATE`s.

**Rejected alternatives**:
- Separate `disambiguation_pages` table. Adds a table for a read-time rendering concern. Not needed.
- URL suffix `?ctx=markets`. Query strings are invisible in shared links; worse UX.

---

## 2. Concept drift over time (version pinning)

**Problem**: A briefing from March references the "Safeguard Mechanism" concept card. By November, the card has been edited to reflect a scheme amendment. When a user clicks the March briefing's inline tooltip, what do they see?

**Decision**:

- **References pin both `concept_card_id` and `concept_card_version`**. Enriched articles and learning path items that refer to a card record the version at time-of-write. Schema: `learning_path_items.item_version`; for enriched articles we'll add `concept_refs JSONB[]` in Phase 3 when inline rendering is wired (additive column, not in Phase 1 migration because Phase 1 is schema-only for Learn tables).
- **At render time, compare current vs pinned**:
  - If `current.content_hash == pinned.content_hash` → render current content transparently.
  - If they differ → compute similarity (cosine on chunk_text embedding). If similarity ≥ 0.85, render current with no marker (minor wording change, safe).
  - If similarity < 0.85 → render current content with a subtle marker: *"This concept has evolved since this briefing was written — tap to see what changed."* Link opens a modal showing a brief diff (current summary vs pinned summary).
- **Old versions are not stored**. The comparison is version-hash against current, similarity-check on current text. This gives us the user-facing "has evolved" signal without the storage cost of history.

**Rejected alternatives**:
- Keep full history in `concept_card_versions` table. Storage cost grows with edit frequency; user demand unclear. Add later if needed.
- Silently always show current content. Loses the integrity signal — a reader would think the briefing author wrote with today's definition in hand.
- Always show pinned content. Stale; could mislead if the concept has materially changed.

**Threshold**: 0.85 cosine on the card's inline_summary embedding. Tunable; initial value based on intuition. Phase 3 adds telemetry to see how often the "evolved" marker fires; recalibrate if needed.

---

## 3. Editor-review decay

**Problem**: A concept card or brief block reviewed in January 2025 is still badged "EDITOR REVIEWED" in April 2026. That's a lie — the world has moved on and the editor hasn't re-examined it.

**Decision**:

- **Default decay window: 180 days on `reviewed_at`**.
- **A daily cron job** (`/api/learn/decay-editorial-status`, gated on `LEARN_DECAY_ENABLED=true` env flag) does exactly one thing: finds rows with `editorial_status='editor_reviewed'` AND `reviewed_at < NOW() - INTERVAL '180 days'`, updates them to `editorial_status='previously_reviewed_stale'`. **Content is not modified**; only the status column changes.
- **The `<EditorialStatusBadge>` component** renders `previously_reviewed_stale` as a muted "previously editor-reviewed · last checked 287 days ago" rather than a crisp green check. Honest signal to the reader without spookily removing the reviewed marker overnight.
- **Re-review** is trivial: editor updates content or explicitly re-affirms; `reviewed_at` gets bumped; status flips back to `editor_reviewed`.
- **Per-block decay for briefs** — the per-block cadence policy (manual, daily, weekly, quarterly, yearly) drives an independent decay calculation: a `fundamentals` block (yearly cadence) decays 540 days; a `current_state` block (weekly cadence) decays 21 days. These are soft tunables in `src/lib/learn/decay-config.ts`; 180 days is only the default for cards.

**Rejected alternatives**:
- No decay; editors manually clear. Nobody does this consistently; trust markers become stale and lie by omission.
- Auto-archive after decay. Too destructive — the content is probably still useful, just not verified-fresh.
- Hide badge entirely after decay. Worse UX than the honest "previously reviewed" signal.

---

## 4. Brief block partial state

**Problem**: A microsector brief has 8 block slots (`nicks_lens`, `fundamentals`, `key_mechanisms`, `australian_context`, `current_state`, `whats_moving`, `watchlist`, `related`). On any given day, half may be `editor_authored`, half `ai_drafted`, two may be empty (not yet generated), `nicks_lens` may be entirely absent. How do we render without it looking broken?

**Decision**:

- **Every block renders independently** with its own status badge + last-updated timestamp. A block card with `editor_authored` sits next to a block card with `ai_drafted` without visual inconsistency — the badge tells the reader the difference.
- **Empty blocks collapse**. An absent `nicks_lens` doesn't leave a placeholder ("Nick hasn't written anything yet") — it simply isn't rendered. The brief feels complete with whatever subset is available.
- **`nicks_lens` rendering is prominent when present** — top of the brief, larger type, distinct visual treatment (mirrors the daily editorial override pattern). When absent, the brief starts with whichever block is first by the canonical ordering.
- **Canonical block ordering**: `nicks_lens`, `fundamentals`, `key_mechanisms`, `australian_context`, `current_state`, `whats_moving`, `watchlist`, `related`. Stable so users learn the shape; empty blocks just collapse out.
- **A brief with zero blocks is a 404 equivalent** — not a blank page. The brief row exists (FK to taxonomy_microsector), but if no blocks exist, the microsector page renders the "low-signal microsector" variant (the "quarterly pulse" treatment) seeded from Phase 2's default content.

**Rejected alternatives**:
- Placeholder blocks ("AI is generating this..."). Feels broken; undermines trust. Collapse is cleaner.
- Force all 8 blocks before publish. Over-constrains editorial workflow; some microsectors don't need all blocks (agriculture may skip `key_mechanisms`).

---

## 5. Path update policies

**Problem**: A learning path contains references to concept cards + brief blocks + articles. Substrate changes over time. Does the path change with it, or stay frozen?

**Decision**: three policies selected per-path on creation.

- **`frozen`**: path items are pinned by version. Substrate changes are invisible. Card drift renders with the "has evolved" marker from edge-case #2 but items are not swapped. Default for **user-generated paths** (the user got the path they asked for; not our place to silently rewrite it).
- **`live`**: path structure is stable, but item content follows current versions. Card edits propagate automatically. No "has evolved" marker (current is current). Default for **editor-curated seed paths** — editors want their recommendations to reflect the latest authoritative content.
- **`periodic`**: path is regenerated on a cadence. Each period gets a **new row** (new slug suffixed with period, e.g., `grid-week-2026-04-20`); old rows remain accessible as archive. Default for **auto-generated periodic paths** ("This week in grid", "Carbon markets Q2 2026 snapshot").

**Per-context defaults summary**:

| Context | Default `update_policy` | Rationale |
|---|---|---|
| User enters `/learn/paths/generate` → saves a path | `frozen` | User commissioned this path; don't silently rewrite it. |
| Editor authors a seed path via CLI | `live` | Editorial voice wants to stay current. |
| Cron creates "week in X" | `periodic` | New period = new row, archived. |

Editor can override per-path. Schema: `update_policy TEXT NOT NULL CHECK IN ('frozen','live','periodic')` with no default — explicit on insert, forces the choice.

**Rejected alternatives**:
- Single global policy. Loses the three distinct use cases.
- Policy per-item instead of per-path. Over-complicates review UX; editors think in paths, not items.

---

## 6. Canonical content in surfaces (pinning overrides)

**Problem**: A client microsite on `/s/agl-pathways` references the "Marginal Loss Factor" concept card. Canonical content is updated (MLF definition refined). The client is mid-programme; they don't want their curriculum shifting underfoot.

**Decision**:

- **Surface overlay can pin specific concept_card versions** via `knowledge_surfaces.overlay.pinned_versions` JSONB: `{ "concept_card_id_1": 3, "microsector_brief_block_id_2": 7 }`. Surface-scope retrieval honours these pins — a query for "MLF" inside this surface returns version 3 even if canonical is now at version 5.
- **Pinning is per-content, per-surface**. No global "freeze everything" button — that creates maintenance nightmare. Surface owner pins the items they explicitly want stable (usually: the concept cards referenced by their curriculum).
- **UI affordance**: surface admin dashboard shows a "pinned items" table with current canonical version vs pinned version. When canonical moves ahead, admin gets a notification: "MLF card updated canonically — version 3 (pinned) → version 5 (current). Review to refresh your surface."
- **Non-pinned content** in a surface follows canonical. Surfaces are overlays over substrate, not forks.
- **Pinning a version that later gets `superseded_by`**: if the pinned version's parent card is replaced (slug split, disambiguation), the pin still resolves — we store `(card_id, version)` pair, both are immutable. Admin gets notified to re-point the pin.

**Rejected alternatives**:
- Surface-level forks of content (copy on pin). Duplicates content, complicates search, breaks "single source of truth". Reject.
- No pinning — surfaces always show canonical. Breaks the "course integrity" use case; a cohort part-way through a Course shouldn't have the text under them change.

---

## 7. Taxonomy evolution (microsector splits/merges)

**Problem**: Taxonomy changes over time. "Hydrogen" as a single microsector gets split into "Green Hydrogen" and "Blue Hydrogen" because the economics diverged. An existing surface scoped to `[hydrogen]` — what happens?

**Decision**:

- **Additive columns on `taxonomy_microsectors`**: `deprecated_at TIMESTAMPTZ`, `merged_into INTEGER REFERENCES taxonomy_microsectors(id)`.
- **Merge** (multiple → one): old ID rows get `deprecated_at = NOW()`, `merged_into = new_id`. The `microsector_briefs` row for the old ID is preserved; a new brief for the new ID is seeded from a merge of the old briefs' content (editor reviews the merged draft).
- **Split** (one → multiple): old ID row gets `deprecated_at = NOW()`, `merged_into = NULL` (NULL because split is multi-target). The old brief is preserved. New briefs for the split IDs are seeded from the old brief's content (editor reviews each).
- **Surface scope adaptation**:
  - On merge: surface scopes that include the old ID auto-include the merged_into ID.
  - On split: surface scopes that include the old ID are flagged for admin review — the scope filter automatically expands to include all successor IDs (`merged_into IS NULL AND deprecated_at > scope_created_at` walks the descendants), and a notification is sent to the surface admin asking them to confirm or narrow the scope.
- **Deprecation is not immediate deletion**. Old microsector IDs stick around indefinitely; their FKs from briefs, enriched_articles, etc. remain valid. The `deprecated_at` is a signal, not a lifecycle end.
- **Retrieval behaviour**: `retrieveContent()` with `filters.microsector_ids = [old_id]` continues to work (returns content tagged with the old ID). `retrieveForLearn()` optionally expands the scope to include successors (opt-in via `opts.followDeprecation: true`).

**Rejected alternatives**:
- Hard-delete old IDs with a one-time migration. Breaks historical references in enriched_articles, content_embeddings. Catastrophic.
- Never evolve taxonomy; add new IDs alongside old. Leads to sprawl and classifier drift. Worse.

---

## 8. Uploaded client docs — storage, isolation, deletion

**Problem**: A client uploads proprietary docs into their surface. We need to (a) make the docs retrievable inside the surface, (b) keep them invisible to canonical retrieval, (c) guarantee deletion when the client asks.

**Decision**:

- **Storage**: Vercel Blob under per-surface prefix `surfaces/{surface_id}/uploads/{doc_id}.{ext}`. Blob provides HTTPS URLs; `knowledge_surface_content.blob_url` + `blob_path` record both. Access to the Blob URL is signed/short-lived for rendering; no direct public URL.
- **Indexing**: upload pipeline chunks the doc (reuse existing `src/lib/intelligence/chunker.ts`), embeds with Gemini (reuse `src/lib/intelligence/embedder.ts`), writes chunks to `content_embeddings` with `content_type='uploaded_doc'`, `source_id=knowledge_surface_content.id`, and a new `metadata->>'surface_id'` field on the chunk row. Pre-existing `content_embeddings` schema already supports arbitrary content_type values (post-prelude migration).
- **Isolation**: scope filter (Phase 4) injects `WHERE (metadata->>'surface_id' = $surface_id OR content_type NOT IN ('uploaded_doc','surface_module'))`. Canonical retrieval never sets `surface_id`, so uploaded_doc rows are rejected. Defence-in-depth, not DB-enforced — a developer accidentally querying `content_embeddings` directly without the scope filter would see uploaded docs. Remediation in Phase 4: centralise all retrieval behind `retrieveForLearn()` / `retrieveForSurface()` helpers that enforce the filter.
- **Hard deletion** on client request:
  1. Mark `knowledge_surface_content.deleted_at = NOW()`.
  2. Enqueue a hard-delete job that: (a) calls Blob delete on `blob_path`, (b) deletes `content_embeddings` rows where `content_type='uploaded_doc' AND source_id = doc_id`, (c) deletes the `knowledge_surface_content` row, (d) writes an audit-log entry to the existing `editorial_activity_log` table with `action='hard_delete'`, the doc title (preserved), and the requesting user ID.
  3. Job runs within 24 hours. Client request includes a 24h deletion SLA contract.
- **Deletion propagation to paths**: if the deleted doc is referenced in a `learning_path_items` row (within the same surface), the row is soft-removed (position gap preserved) and a notification is sent to the surface admin to re-sequence. No cascade delete that could orphan paths.

**Rejected alternatives**:
- Vercel Blob without per-surface prefix. Makes accidental cross-surface exposure harder to detect.
- S3 with signed URLs. More moving parts; Blob already provisioned on this project.
- Row-level security at the Postgres layer. Correct long-term but heavy; start with application-layer isolation and upgrade in Phase 4 if needed.
- Soft-delete only (no hard delete). Violates client confidentiality contracts. Non-starter.

---

## Summary table (all 8 decisions at a glance)

| # | Concern | Decision | Reversible? |
|---|---|---|---|
| 1 | Disambiguation | `(slug, disambiguation_context)` unique; read-time disambiguation page | Yes — schema level trivial |
| 2 | Concept drift | Pin `(card_id, version)`; hash-diff + similarity for "has evolved" marker at 0.85 threshold | Threshold tunable post-launch |
| 3 | Review decay | 180-day default; daily cron flips to `previously_reviewed_stale`; never touches content | Window easily changed; cron can be paused |
| 4 | Brief partial state | Blocks independent; empty collapse; `nicks_lens` prominent when present | Cosmetic; no schema lock-in |
| 5 | Path policies | `frozen` / `live` / `periodic` — three policies, per-path choice on create | Reversible per-path |
| 6 | Surface overrides | JSONB `overlay.pinned_versions`; admin notified when pinned → canonical drifts | Fully reversible; unpin = remove key |
| 7 | Taxonomy evolution | `deprecated_at` + `merged_into`; surface auto-adapt for merge, flag for split | Adding columns is additive; deprecation metadata recoverable |
| 8 | Uploaded docs | Blob per-surface prefix; scope-filter isolation; 24h hard-delete with audit log | Delete operations audited; storage layer swappable |

Decisions with highest blast radius on misjudgement: **#3 (review decay window)** and **#7 (taxonomy evolution)**. Both carry ongoing maintenance cost and shape behaviour months from now. Phase 1 checkpoint should spend most time stress-testing these two.
