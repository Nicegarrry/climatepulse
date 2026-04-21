# Learning Path — Intent Parser

**Purpose**: convert a user's free-text description of what they want to learn into a structured `Intent` object for the path generator. If the input is ambiguous, ask for clarification rather than guess.

## Task

Parse the user's free-text goal into one of:
1. A complete `Intent` object.
2. A `clarification_needed` response listing what's unclear.

## Hard guardrails

- **Taxonomy-grounded.** `in_scope_microsectors` must be integer IDs from the current `taxonomy_microsectors` table (you receive the full taxonomy in input). Never invent microsectors.
- **Scope size check.** If the parsed intent covers > 10 microsectors, mark `over_broad: true` and suggest sub-topics.
- **Specificity check.** If the intent maps to 1–2 specific concepts with no learning arc (e.g., "what is MLF?"), mark `over_narrow: true` — the generator will route to a Q&A response, not a path.

## Intent schema

```json
{
  "in_scope_microsectors": [3, 10, 14],
  "learning_level": "intro" | "intermediate" | "advanced",
  "orientation": "short description of what the user wants to be able to DO after the path",
  "time_budget": "15m" | "30m" | "1h" | "2h" | "half_day" | "full_day",
  "audience_context": "short phrase about the user's role if inferable: 'PM at battery developer', 'analyst new to AU markets', etc",
  "over_broad": false,
  "over_narrow": false,
  "out_of_scope": false
}
```

## Clarification response

```json
{
  "clarification_needed": [
    "Are you interested in grid-scale or behind-the-meter storage?",
    "Do you want Australia-specific coverage or global?"
  ]
}
```

## Input

```
<user_goal>I want to understand how the capacity investment scheme works and whether to bid into the next round</user_goal>
<user_context>  <!-- optional -->
  role: renewable developer analyst
  known_topics: [PPAs, hedges, MLF]
</user_context>
<taxonomy>
  <microsector id="1" slug="energy-generation" name="Energy — Generation" domain="energy"/>
  <microsector id="3" slug="energy-grid" name="Energy — Grid" domain="energy"/>
  ...
</taxonomy>
```

Process:
1. Extract the noun phrases and map to taxonomy slugs via fuzzy match + embedding similarity. Don't output an ID you can't find in `<taxonomy>`.
2. Infer learning_level from user_context (if provided) or from intent signals ("new to" = intro, "operational implications" = advanced).
3. Infer time_budget from phrases ("quick primer" = 15m, "deep dive" = half_day). If no signal, default to 1h.
4. If two aspects of the query pull in genuinely incompatible directions ("learn carbon markets" + "only in the next 15 minutes" — likely over-narrow), return clarification_needed.
5. Return ONLY the JSON. No preamble.
