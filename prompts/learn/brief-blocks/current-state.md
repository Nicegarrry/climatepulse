# Microsector Brief — Current State Block

**Cadence**: weekly. Decay: 21 days (becomes stale fast). **Voice**: state-of-play, dense with numbers. Synthesises the last 90 days of substrate into a "here's where we are" snapshot.

## Task

Produce a current-state narrative of ~300 words plus a structured "current metrics" block. Input is substrate from the last 90 days (enriched articles + relevant content_embeddings rows for this microsector). Output JSON.

## Hard guardrails

- Every number cited must trace to a source in input.
- If the last 90 days has fewer than 8 signal items, refuse with `{"refused": "thin_substrate"}` — the "quarterly pulse" variant is rendered instead.
- No prediction of future state. This block is what *is*, not what *will be*.
- Date references must be relative to the generation date (e.g., "this week", "in the past month"), not absolute ("April 2026") — keeps the block readable when re-encountered 2 weeks later.

## Output schema

```json
{
  "body": "300 words max, plain prose. Open with the dominant theme of the past 90 days. Cover: major regulatory actions taken, significant project milestones, notable price/market movements, any regime-change signals (if the brief is regime_change_flagged). Close with one line on where the microsector sits vs 90 days ago.",
  "body_json": {
    "metrics": [
      {"label": "Connection queue size", "value": "42 GW pending", "delta": "+3 GW over 90 days", "source_ref": "source_id from input"},
      ...
    ],
    "dominant_signal_types": ["policy_change", "project_milestone"],
    "significant_entities": ["entity names that surfaced most"]
  },
  "source_citations": [...],
  "uncertainty_flags": []
}
```

Refusal reasons: `thin_substrate` (fewer than 8 substrate items in 90d), `insufficient_sources` (<3 citable sources).

## Input

```
<microsector>energy-grid</microsector>
<domain>energy</domain>
<window_from>2026-01-20</window_from>
<window_to>2026-04-20</window_to>
<regime_change_flagged>false</regime_change_flagged>
<substrate>
  <item type="enriched_article" id="..." published_at="..." significance="72" signal_type="policy_change">
    <title>...</title>
    <summary>...</summary>
  </item>
  ...
</substrate>
```

Process:
1. Scan substrate. Identify 2–3 dominant themes (e.g., "AEMO FY26 MLF update" + "HumeLink contract awarded" → theme: transmission build + MLF repricing).
2. Write the narrative around the themes, not as a list of items.
3. Extract 3–6 metrics with clear deltas. Delta > absolute value in usefulness.
4. If regime_change_flagged=true, the block opens with a reference to the flagged shift.
