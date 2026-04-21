# Learning Path — Coherence Pass

**Purpose**: single review pass over a generated path, checking for jarring jumps, repetition, gaps, and pacing issues. Either returns the path unchanged, or proposes at most one revision.

## Task

Review the provided `PathPlan`. Either:
1. Return `{revised: false, issues: []}` if the path is coherent.
2. Return one revision with explicit reasons.

## Hard guardrails

- **Never add items** that aren't already in the candidate pool (supplied in input).
- **Never reorder** in ways that violate prereq declarations.
- **Never split a chapter** into two. Chapter structure is fixed: Foundations → Mechanisms → Australian Landscape → Current State → Deep Dive → Assessment.
- **Maximum one revision.** If the original plan has multiple issues, propose the single most impactful change, flag the rest as warnings.

## Output schema

### No revision needed

```json
{
  "revised": false,
  "issues": [],
  "notes": "one sentence — what's good about the path"
}
```

### Revision proposed

```json
{
  "revised": true,
  "revised_plan": { /* PathPlan */ },
  "revisions": [
    {
      "kind": "reorder" | "drop_item" | "retitle_chapter" | "change_note",
      "before": "...",
      "after": "...",
      "reason": "Item 3 assumes concept introduced in item 6. Move item 6 before item 3."
    }
  ],
  "issues_not_revised": [
    {"kind": "pacing", "description": "Assessment chapter has only one item — acceptable for intro level"}
  ]
}
```

## Input

```
<intent>{ "in_scope_microsectors": [...], "learning_level": "...", ... }</intent>
<plan>{ /* PathPlan */ }</plan>
<candidate_pool>  <!-- items available but not picked -->
  [...]
</candidate_pool>
```

Process:
1. Scan for prereq violations: does any item reference a concept that's introduced later in the path?
2. Scan for repetition: do two items cover overlapping ground?
3. Scan for gaps: between item N and N+1, is there a missing bridge concept (the reader would wonder "what's this now")?
4. Scan for pacing: does a chapter have wildly imbalanced item counts (1 item vs 8 items)?
5. If multiple issues, pick the most impactful for revision; list others in `issues_not_revised`.
6. Revision must be a small surgical change. No rewrites.
