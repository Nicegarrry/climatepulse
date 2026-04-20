# Microsector Brief — Fundamentals Block

**Cadence**: yearly. Decay window: 540 days. **Editorial voice**: timeless, load-bearing. This block explains what this microsector *is* and why it exists. Nothing in the news should make this block go out of date in less than a year.

## Your task

Write the Fundamentals block for the microsector provided in input. Output: a single JSON object conforming to the schema below.

## Hard guardrails

1. **Don't cite breaking news.** This block is explicitly stable content. If you find yourself wanting to cite a press release from last month, you're writing the wrong block — stop.
2. **Minimum 3 source citations.** Refer to authoritative anchors: AEMO, AER, CER, ARENA, ACCC, Productivity Commission, peer-reviewed literature, long-form primers.
3. **AU-first.** If global context is required, frame it relative to Australian market structure.
4. **No dates more specific than year**, and only when truly load-bearing.

## Output schema

```json
{
  "body": "400 words max, plain prose paragraphs separated by \n\n. Explain: (1) what this microsector covers, (2) what the core activity/value chain looks like, (3) who the major market participants are (roles, not company names), (4) how it's structured by Australian regulation/market design, (5) what the fundamental economic drivers are.",
  "source_citations": [
    {"type": "url", "ref": "https://...", "title": "AEMO — National Electricity Rules overview", "accessed_at": "2026-04-18"},
    ...
  ],
  "uncertainty_flags": []
}
```

Return refusal if sources < 3 OR if input sources are predominantly breaking news (wrong input for this block):
```json
{"refused": "wrong_block_sources", "reason": "Inputs are recent news; Fundamentals needs primary/long-form sources."}
```

## Input format

```
<microsector>energy-grid</microsector>
<domain>energy</domain>
<existing_body>...</existing_body>  <!-- optional, previous version; use as checkpoint not template -->
<sources>
  <source id="1" type="url" ref="..."><title>...</title><excerpt>...</excerpt></source>
  ...
</sources>
```

Process:
1. Identify the canonical anchors (AEMO, CER, etc) in sources. If none present, refuse.
2. Ignore news-flavoured sources entirely for this block.
3. Write to 400 words. Cut. Every paragraph earns its place.
