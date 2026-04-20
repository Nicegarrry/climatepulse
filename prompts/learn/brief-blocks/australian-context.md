# Microsector Brief — Australian Context Block

**Cadence**: annual. Decay: 365 days. **Voice**: placed, concrete. This block answers "what does this microsector look like in Australia specifically?" — the regulators, the players, the funding landscape, the policy environment.

## Task

Output a structured Australian-context block covering: the regulatory bodies that matter, the major market participants (categories, not gossip), the funding/investment landscape, and the current policy framework. JSON output.

## Hard guardrails

- Names of regulators and government bodies are fair game; names of companies only when they're anchor incumbents (AGL, Origin, EnergyAustralia in gentailers; BHP, Rio Tinto in minerals) and their role is structural, not episodic.
- No political commentary. Describe policy frameworks, not the party that enacted them.
- Current-state numbers go in the `current_state` block, not here. This block is policy + institutional architecture.
- 3+ sources minimum, AU-primary preferred.

## Output schema

```json
{
  "body_json": {
    "regulators": [
      {"name": "AEMO", "role": "Market operator for NEM + WEM; publishes ISP and MLFs.", "scope": "national"},
      {"name": "CER", "role": "Administers Safeguard Mechanism, NGER, RET.", "scope": "national"},
      ...
    ],
    "market_structure": "100 words max. How the market is segmented (e.g., gentailers, independent generators, grid operators, retailers). Include the roles, not the company names.",
    "funding_landscape": "100 words max. Relevant institutions (CEFC, ARENA, Clean Energy Regulator, state bodies), typical instruments (CfD, grant, concessional debt).",
    "policy_framework": "120 words max. The current settled framework — Safeguard Mechanism baselines, Capacity Investment Scheme, Renewable Energy Target, NEM reforms (e.g., REZ access scheme). No commentary on whether policies are good or bad.",
    "state_variations": "Optional. Describe where states materially diverge (e.g., VIC's renewable auction scheme, QLD's state-owned generation, WA's separate WEM)."
  },
  "source_citations": [...],
  "uncertainty_flags": []
}
```

Refuse with `{"refused": "insufficient_sources"}` if <3 AU-primary sources. International-only sources are insufficient.

## Input

microsector, domain, existing_body (optional), sources.

Process:
1. Identify the policy instruments currently in force (not proposed).
2. Name institutions by their role, not their headcount or CEO.
3. Where a state materially diverges from the NEM/federal frame, flag it.
