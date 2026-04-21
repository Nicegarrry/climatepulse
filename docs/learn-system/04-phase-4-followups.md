# Phase 4 — deferred follow-ups

Living list of known-but-deferred items from the Knowledge Surfaces build. Each has a short note on **why** it was deferred and the **signal** that should unblock it.

---

## Deferred during Phase 4

### 1. PDF text extraction
- **Where:** `src/lib/surfaces/uploads.ts` — `indexDocument()` flags PDFs with `body_json.indexing_skipped = true`.
- **Why deferred:** pulls in a new dependency (`pdf-parse` or similar); not blocking for the first shipping surfaces.
- **Unblock when:** first client uploads a PDF they expect to be searchable. Add the extractor, call `indexDocument()` post-extraction, drop the `indexing_skipped` flag.

### 2. Durable rate limiter (Upstash / Vercel KV)
- **Where:** `src/lib/surfaces/rate-limit.ts` — in-memory sliding window.
- **Why deferred:** per-container limiter is fine for the projected bot-mitigation volume. Adding Redis/KV is a real infra decision.
- **Unblock when:** first surface gets real public traffic and we see requests crossing container boundaries. Swap `checkRateLimit()` for the equivalent keyed in Upstash/KV; keep the helper signature stable so call sites don't change.

### 3. `branding.custom_css` rendering
- **Where:** `src/lib/surfaces/config.ts` validates + stores the string; `src/app/s/[slug]/page.tsx` does **not** inject it into a `<style>` tag. Dashboard's admin UI allows editors to paste custom CSS without it having any effect on the rendered surface.
- **Why deferred:** the validator refuses obvious `<script>` / `<style>` / `<iframe>` tags, but that's not a sufficient sandbox. Concerns that warrant a dedicated sanitizer pass before shipping:
  - `url(javascript:...)` and data-URI vectors
  - `</style>` via exotic encodings that the regex might miss
  - Cross-surface CSS bleed if namespacing is wrong
- **Unblock when:** we either (a) add a CSS sanitizer like `postcss-safe-parser` + an allowlist of properties, or (b) restrict custom CSS to a set of ~20 named tokens (colour, font-family, spacing) with a `SurfaceBranding.tokens` shape and render those via CSS variables only. Option (b) is probably the right long-term answer; option (a) unlocks more power but carries more risk.

### 4. Private-access Blob storage
- **Where:** `src/lib/surfaces/uploads.ts` — `putToBlob()` uses `access: 'public'` for parity with the podcast-storage pattern, with app-layer gating via `resolveAccess` on every download-triggering route.
- **Why deferred:** `@vercel/blob` treats `private` access as beta in the installed version (2.3.3). App-layer gating already provides the isolation guarantee as long as the Blob URL is never leaked through `/s/[slug]` server responses for non-members.
- **Unblock when:** private access stabilises in `@vercel/blob`. Swap `access: 'public'` → `'private'` and route downloads through a signed proxy.

### 5. Course `item_id` resolver contract
- **Where:** `src/app/s/[slug]/CourseView.tsx` — falls back to best-effort `(concept_card | microsector_brief)` lookup when chapter `item_ids` are supplied without a `type:` prefix.
- **Why deferred:** needs a clear decision from admin-UI side on whether `chapter.item_ids` entries should be `"type:id"` strings or structured `{type, id}` objects.
- **Unblock when:** admin surfaces UI finalises its chapter-builder UX. The resolver can then assume the strict shape and drop the fallback.

### 6. Cohort/Presentation/Briefing templates
- **Where:** not implemented; schema allows only `template IN ('hub','course')`.
- **Why deferred:** plan-level — wait until Hub + Course have been shipped to real clients and usage patterns suggest what's missing.
- **Unblock when:** a concrete client need lands that Hub + Course can't meet.

### 7. Custom-domain support
- **Where:** not implemented; surfaces live at `/s/[slug]` only.
- **Why deferred:** product-level — needs a DNS + cert story, and a decision on billing model.

### 8. Billing / surface deactivation
- **Where:** not implemented; the `archived` lifecycle state is the only way to retire a surface.
- **Unblock when:** first real paid surface.

---

## Resolved during this "continue while user is away" pass

- **`editorial_status` surfacing in `RetrievedContent`** — done in Phase 3 pre-work commit `1d69a28`. `retrieveForLearn` editorial boost + allowlist are live.
- **Path-generator token accounting** — done in this pass. `parseIntentWithUsage` returns `{intent, inputTokens, outputTokens}`; `coherencePass` returns tokens in `CoherencePassResult`; `generatePath` sums both into `logGeneration`.
- **Inline concept tooltip wiring** — done in this pass. Introduced the `[[slug]]` / `[[slug|display]]` / `[[slug|display|context]]` markup convention via `src/components/learn/render-prose-with-tooltips.tsx` and wired into the concept-card full_body and microsector brief prose renderers. Editor-authored and AI-drafted content can opt in by sprinkling the tokens into prose — no auto-scanning, no risk of false positives.
- **Unused `LearnTab` import** in the dashboard cleaned up (the dashboard Learn tab now uses `<LearnRedirect>`).

---

## Still carried from Phase 3

- **2 curated seed paths** (AU Electricity Markets + Carbon Markets) — authored interactively via `scripts/learn/author-path.ts`. Needs user attention.
- **Editorial queue endpoint** for `regime-change-detector.ts` — currently `console.log`-stubbed. The admin UI's member + upload queue patterns can be reused once the editorial-queue endpoint spec is agreed.
- **`briefing | deep_dive | podcast | quiz` item types** in the path reader — current reader renders "(Missing content)". Wire once those polymorphic sources have real content.
