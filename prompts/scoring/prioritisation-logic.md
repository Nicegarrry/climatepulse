# Significance Scoring System

## Composite Formula

```
composite = (
  impact_breadth * 25 +
  novelty * 20 +
  decision_forcing * 20 +
  quantitative_magnitude * 15 +
  source_authority * 10 +
  temporal_urgency * 10
) / 10
```

Produces a score from 0 to 100.

## Target Distribution

- Mean: ~50
- Standard deviation: ~15
- 75+: ~10% (top-of-briefing, alert-worthy)
- 40-75: ~60% (included in briefing at various priority levels)
- Below 40: ~30% (Explore/archive only)
- 90+: <2% (landscape-changing, maybe 1-2 per month)

## Thresholds

| Threshold | Use |
|-----------|-----|
| 70+ | Push alerts for users following relevant topics |
| 40+ | Daily briefing triage cards |
| Below 40 | Explore/archive only |

## Weekly Normalisation

Run every Sunday night:
1. Compute actual mean and stddev from past 7 days
2. If mean has drifted above 55 or below 45, apply linear rescaling to shift back to 50
3. Log drift for monitoring — consistent upward drift suggests prompt tuning needed
