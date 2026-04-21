import { Fragment } from "react";
import { InlineConceptTooltip } from "./inline-concept-tooltip";

/**
 * Renders plain prose and swaps a small markup token for inline concept
 * tooltips.
 *
 * Markup convention:
 *   [[slug]]               → tooltip with the slug as display text
 *   [[slug|display text]]  → tooltip with custom display text
 *   [[slug|display|ctx]]   → tooltip with an explicit disambiguation context
 *
 * Lives opt-in: prose without any tokens renders normally. Editors can
 * sprinkle these into concept full_body, microsector brief blocks, and
 * briefing narrative without needing a full markdown parser.
 *
 * Paragraph split on double-newline; token parsed per paragraph.
 */
const TOKEN_RE = /\[\[([^\]|]+?)(?:\|([^\]|]+?))?(?:\|([^\]|]+?))?\]\]/g;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,80}$/;

interface ParsedSegment {
  kind: "text" | "concept";
  text: string;
  slug?: string;
  context?: string;
}

export function parseConceptMarkup(input: string): ParsedSegment[] {
  if (!input || !input.includes("[[")) {
    return [{ kind: "text", text: input ?? "" }];
  }
  const out: ParsedSegment[] = [];
  let lastIndex = 0;
  for (const match of input.matchAll(TOKEN_RE)) {
    const [raw, slugRaw, displayRaw, ctxRaw] = match;
    const start = match.index ?? 0;
    const slug = (slugRaw ?? "").trim();
    if (!SLUG_RE.test(slug)) {
      // Invalid slug — emit literally so we don't swallow content accidentally.
      continue;
    }
    if (start > lastIndex) {
      out.push({ kind: "text", text: input.slice(lastIndex, start) });
    }
    out.push({
      kind: "concept",
      text: (displayRaw ?? slug).trim(),
      slug,
      context: ctxRaw?.trim() || undefined,
    });
    lastIndex = start + raw.length;
  }
  if (lastIndex < input.length) {
    out.push({ kind: "text", text: input.slice(lastIndex) });
  }
  return out;
}

interface Props {
  /** Prose with `[[slug|display]]` tokens. `\n\n` splits paragraphs. */
  body: string;
  /** Applied to each `<p>` element. */
  paragraphClassName?: string;
  paragraphStyle?: React.CSSProperties;
}

/**
 * Render prose paragraphs with inline concept tooltips. First-occurrence-
 * only behaviour is enforced by a `<ConceptTooltipScope>` further up the
 * tree — this component does not introduce one itself.
 */
export function ProseWithTooltips({ body, paragraphClassName, paragraphStyle }: Props) {
  const paragraphs = body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return (
    <>
      {paragraphs.map((para, i) => {
        const segments = parseConceptMarkup(para);
        return (
          <p key={i} className={paragraphClassName} style={paragraphStyle}>
            {segments.map((seg, j) => {
              if (seg.kind === "text") {
                return <Fragment key={j}>{seg.text}</Fragment>;
              }
              return (
                <InlineConceptTooltip
                  key={j}
                  slug={seg.slug!}
                  context={seg.context}
                >
                  {seg.text}
                </InlineConceptTooltip>
              );
            })}
          </p>
        );
      })}
    </>
  );
}
