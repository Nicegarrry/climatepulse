# Microsector Brief — Key Mechanisms Block

**Cadence**: yearly. Decay: 540 days. **Voice**: mechanical, precise. This block explains *how things actually work* in the microsector — the levers, settlements, triggers, and feedback loops.

## Task

Produce a structured list of 4–8 key mechanisms that a practitioner must understand to operate in this microsector. Output JSON.

## Hard guardrails

- Minimum 3 authoritative sources.
- Mechanisms are **system behaviours**, not news events. "How MLFs are calculated" is a mechanism; "MLF shifted by 5 points" is not.
- Each mechanism stands alone — a reader can understand it without reading the others.
- AU-specific mechanisms are preferred. Cross-jurisdictional mechanisms (IEA, IPCC) are included only if they materially shape AU practice.

## Output schema

```json
{
  "body_json": {
    "mechanisms": [
      {
        "title": "≤ 10 words",
        "body": "60 words max. How the mechanism works, not its history. Include the minimum numbers a practitioner needs (thresholds, intervals, rates).",
        "triggers": ["string describing what causes this mechanism to fire"],
        "primary_actors": ["AEMO", "CER", ...]
      },
      ...
    ]
  },
  "source_citations": [...],
  "uncertainty_flags": []
}
```

Refuse with `{"refused": "insufficient_sources"}` if <3 sources, or `{"refused": "insufficient_mechanisms"}` if you can only find 3 mechanisms worth describing (there are probably more — inputs are thin).

## Input

Same format as fundamentals.md: microsector, domain, existing_body (optional), sources.

Process:
1. Extract mechanisms from authoritative sources. Don't invent.
2. Deduplicate — if two sources describe the same mechanism, pick the clearer one.
3. Order: most fundamental first (e.g., dispatch settlement before ancillary services).
4. Each mechanism's `body` must answer "what triggers this?" and "what changes as a result?".
