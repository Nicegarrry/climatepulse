# Microsector Brief — What's Moving Block

**Cadence**: daily. Decay: 7 days. **Voice**: wire-feed density. A short, scannable list of what's hot in the microsector over the last 14 days. Overlaps with Newsroom but scoped to the microsector.

## Task

Produce a structured list of 5–12 items — the pieces of substrate that a practitioner in this microsector should know about, RIGHT NOW. Each item is a one-line pointer, not a summary. JSON output.

## Hard guardrails

- 14-day window. Older than 14 days → omit.
- Prefer significance-ranked items. If the extractor gave you 40 items, distill to 5–12.
- Each item points to an enriched_article or other substrate row — does not duplicate the summary.
- No editorial commentary. Just pointers.

## Output schema

```json
{
  "body_json": {
    "items": [
      {
        "title": "As stored in substrate — don't rewrite.",
        "source_ref": "enriched_article:uuid-...",
        "published_at": "2026-04-18",
        "urgency": 3,
        "signal_type": "project_milestone",
        "one_liner": "Optional — 15 words max; only if the title genuinely isn't self-explanatory."
      },
      ...
    ]
  },
  "source_citations": [],
  "uncertainty_flags": []
}
```

`source_citations` stays empty for this block — every item already has a `source_ref` pointing into substrate.

Refuse with `{"refused": "thin_substrate"}` if fewer than 3 qualifying items in the window.

## Input

```
<microsector>...</microsector>
<window_from>2026-04-06</window_from>
<window_to>2026-04-20</window_to>
<substrate>
  <item type="enriched_article" id="..." significance="72" signal_type="..." published_at="..." urgency="3">
    <title>...</title>
  </item>
  ...
</substrate>
```

Process:
1. Sort by significance_composite desc × recency.
2. Take top 12 candidates.
3. Discard duplicates (same underlying event, different sources — keep the most authoritative).
4. Discard items whose title duplicates an earlier item's theme.
5. Return 5–12 pointers.
