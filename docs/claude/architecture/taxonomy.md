# Taxonomy

3-level hierarchy stored in the database (editable via the Taxonomy admin tab), loaded via `src/lib/enrichment/taxonomy-cache.ts` with a 5-min TTL. Not hardcoded.

## Domains (12)

- Energy–Generation
- Energy–Storage
- Energy–Grid
- Carbon & Emissions
- Transport
- Industry
- Agriculture
- Built Environment
- Critical Minerals
- Finance
- Policy
- Workforce & Adaptation

Full prose definitions + include/exclude examples: `prompts/definitions/domains.md`.

## Sectors (~75) and Microsectors (103)

Sectors sit under domains; microsectors are the leaf nodes. Enrichment assigns 1–3 microsectors per article.

- Prose definitions: `prompts/definitions/micro-sectors.md`
- DB tables: `taxonomy_domains`, `taxonomy_sectors`, `taxonomy_microsectors`

## Cross-cutting tags (5)

- Geopolitics
- AI & Digital
- Gender & Equity
- First Nations
- Disinformation

DB table: `taxonomy_tags`.

## Signal types (10)

Every enriched article gets exactly one:

`market_move | policy_change | project_milestone | corporate_action | enforcement | personnel | technology_advance | international | community_social`

Definitions: `prompts/definitions/signal-types.md`.

## Entity types (6)

`Company | Project | Regulation | Jurisdiction | Person | Technology`

Stored in `entities` with `canonical_name`, `aliases[]`, and auto-discovery logic. Definitions: `prompts/definitions/entity-types.md`.

Resolution flow in enrichment:
1. Exact match on `canonical_name`
2. Alias match on `aliases[]`
3. pg_trgm fuzzy match
4. Otherwise create candidate entity

Auto-promotion of candidates:
- Immediate for `Regulation`, `Project`, `Jurisdiction`
- After 3+ mentions for `Company`, `Person`, `Technology`

## Significance score (6 factors)

Stage 2 enrichment produces a composite 0–100 score in `enriched_articles.significance_composite`:

| Factor | Weight |
|---|---|
| impact_breadth | 25% |
| novelty | 20% |
| decision_forcing | 20% |
| quantitative_magnitude | 15% |
| source_authority | 10% |
| temporal_urgency | 10% |

Scoring spec: `prompts/scoring/prioritisation-logic.md`. Calibration examples: `prompts/scoring/calibration-examples.md`.

## Transmission channels

Hand-authored causal links between domains (e.g. "EU ETS price → Australian offset demand") in `transmission_channels`. Used in future "So What" generation.

## Gotchas

**Prompt domain slugs MUST match DB `taxonomy_domains.slug` exactly.** A `finance-investment` vs `finance` mismatch silently forced 21% of classifications to "uncertain" in April 2026. When adding or editing a domain, check both the DB seed AND every `prompts/definitions/*.md` + `prompts/stage*.md` + `prompts/scoring/calibration-examples.md`.
