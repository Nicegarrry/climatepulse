# Microsector Brief — Watchlist Block

**Cadence**: quarterly. Decay: 120 days. **Voice**: anticipatory but grounded. This block lists 3–8 things a practitioner should keep watching over the coming quarter — scheduled events, pending decisions, known inflection points.

## Task

Produce a structured watchlist. Output JSON.

## Hard guardrails

- Every watchlist item must reference a **known, scheduled, or announced** event or decision. No speculation.
- Acceptable sources: regulator published agendas, publicly disclosed corporate timelines, parliamentary schedules, announced tender cycles, known reporting windows.
- If you can't find 3 watchlist items with citable anchors, refuse.
- Window: next 90 days. Items beyond 90 days go in the "watchlist_horizon" array if useful, capped at 120 days out.

## Output schema

```json
{
  "body_json": {
    "watchlist": [
      {
        "title": "≤ 10 words. The thing being watched.",
        "why_it_matters": "30 words max. Why a practitioner should care.",
        "expected_window": "2026-05 | 2026-Q3 | before end of 2026 — prefer calendar months when known",
        "actor": "AEMO | CER | Federal Govt | Specific Company | etc",
        "source_ref": "source_id or url",
        "confidence": "high | medium | low — how well-anchored is the expected window"
      },
      ...
    ],
    "watchlist_horizon": [
      { "title": "...", "why_it_matters": "...", "expected_window": "2026-Q4", "actor": "...", "source_ref": "..." },
      ...
    ]
  },
  "source_citations": [...],
  "uncertainty_flags": []
}
```

Refusal reasons: `insufficient_anchored_items` (<3 items with citable windows), `insufficient_sources` (<3 citations).

## Input

```
<microsector>...</microsector>
<domain>...</domain>
<today>2026-04-20</today>
<substrate>
  <!-- includes enriched_articles flagged with future-date mentions, plus
       long-lookout items from regulator publications -->
</substrate>
```

Process:
1. Look for explicit future dates in substrate. "AEMO will publish ISP draft in June 2026" → watchlist item.
2. Look for scheduled cycles (annual MLF reset, quarterly CER baseline reviews).
3. Discard anything where the window is less specific than a quarter.
4. If fewer than 3 items qualify, refuse.
