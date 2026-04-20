# Concept Card — Output Schema (Reference)

Loaded by `src/lib/learn/concept-cards/generator.ts` via `loadPrompt("learn/definitions/concept-card-schema.md")` and injected into the generation template as `{{CONCEPT_CARD_SCHEMA}}`. The main prompt (`learn/concept-card-generation.md`) embeds the schema inline for the model; this file is the canonical field reference used both for prompt composition and as documentation for editor-authored cards.

## Fields

| Field | Type | Constraints |
|---|---|---|
| `term` | string | Required. Canonical Australian English form. |
| `abbrev` | string \| null | Optional. Only set if the abbreviation appears in source material. |
| `disambiguation_context` | string | Default `""`. Non-empty only if the term is ambiguous across contexts. |
| `inline_summary` | string | 60 words max. Shown on hover tooltips and list contexts. |
| `full_body` | string | 200 words max. Plain prose (no markdown headings). |
| `key_mechanisms` | `{title,body}[]` | 2–5 entries. `title` ≤ 10 words, `body` ≤ 40 words. |
| `related_terms` | string[] | 3–8 entries. Terms that deserve their own concept card. |
| `visual_type` | enum | One of `none \| chart \| map \| diagram \| photo`. Prefer `none` over invention. |
| `visual_spec` | object \| null | Required iff `visual_type !== 'none'`. Describes the visual for a designer; do not generate SVG. |
| `uncertainty_flags` | `{claim,reason}[]` | Every claim <90% confident goes here. Not optional. |
| `source_citations` | `{type,ref,title,quote?,accessed_at}[]` | **Minimum 3**. `type` ∈ `url \| document \| internal`. Cite only sources provided in input. |
| `primary_domain` | string \| null | `taxonomy_domains.slug` if known. |
| `microsector_ids` | number[] | `taxonomy_microsectors.id` hints, optional. |
| `entity_ids` | number[] | `entities.id` hints, optional. |

## Refusal object

When guardrails can't be met, return a refusal instead of fabricating:

```json
{
  "refused": "insufficient_sources" | "sources_contradict" | "out_of_scope" | "insufficient_context" | "disambiguation_required",
  "reason": "<one-sentence explanation>",
  "suggestion": "<actionable next step>"
}
```

## Editor-authored cards

Editor-authored cards bypass the LLM but must match the same shape. `author-concept-card.ts` accepts a JSON file with the success-object fields above (minus `content_hash`, which is computed server-side). Editor cards land with `editorial_status='editor_authored'`, `ai_drafted=false`.
