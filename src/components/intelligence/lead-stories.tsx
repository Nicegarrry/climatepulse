"use client";

import { useState } from "react";
import { COLORS, FONTS, SEVERITY } from "@/lib/design-tokens";
import type { EditorialStory } from "@/lib/mock-editorial";
import { Micro, SourceTag } from "./primitives";

export function LeadStories({
  stories,
}: {
  stories: EditorialStory[];
}) {
  const [expanded, setExpanded] = useState<number | null>(stories[0]?.id ?? null);

  return (
    <div>
      {stories.map((story, idx) => {
        const sev = SEVERITY[story.severity] || SEVERITY.watch;
        const isOpen = expanded === story.id;
        const isLead = idx === 0;

        return (
          <div
            key={story.id}
            onClick={() => setExpanded(isOpen ? null : story.id)}
            style={{
              // Hero: tinted bg + top accent. Regular: hairline border
              background: isLead
                ? COLORS.paperDark
                : isOpen
                  ? COLORS.surface
                  : COLORS.surface,
              border: isLead
                ? "none"
                : `1px solid ${isOpen ? COLORS.border : COLORS.borderLight}`,
              borderTop: isLead ? `2px solid ${COLORS.forest}` : undefined,
              borderRadius: 8,
              padding: isLead ? "18px 20px" : "14px 20px 14px 16px",
              marginBottom: 10,
              cursor: "pointer",
              // Elevated shadow when expanded (non-lead)
              boxShadow: !isLead && isOpen
                ? "0 2px 8px rgba(0,0,0,0.04)"
                : "none",
              transition: "background 150ms ease, border-color 150ms ease, box-shadow 150ms ease",
            }}
          >
            {/* Header row */}
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 8,
                marginBottom: 6,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {/* Green dot for lead, coloured label for all */}
                {isLead && (
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 6,
                      background: COLORS.forest,
                      display: "inline-block",
                      flexShrink: 0,
                    }}
                  />
                )}
                <Micro color={isLead ? COLORS.forest : sev.labelColor}>{story.sector}</Micro>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                {story.number && (
                  <span style={{ fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: COLORS.ink }}>
                      {story.number}
                    </span>
                    <span style={{ fontSize: 10, color: COLORS.inkMuted, marginLeft: 3 }}>
                      {story.unit}
                    </span>
                  </span>
                )}
                {/* Expand arrow */}
                <span
                  style={{
                    fontSize: 18,
                    color: COLORS.inkFaint,
                    transition: "transform 150ms ease, color 150ms ease",
                    transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                    flexShrink: 0,
                    lineHeight: 1,
                  }}
                >
                  {"\u203A"}
                </span>
              </div>
            </div>

            {/* Headline */}
            <h3
              style={{
                fontFamily: FONTS.serif,
                fontSize: isLead ? 20 : 15,
                fontWeight: 400,
                color: COLORS.ink,
                lineHeight: 1.3,
                margin: 0,
              }}
            >
              {story.headline}
            </h3>

            {/* Source line (always visible) */}
            <div style={{ marginTop: 4, fontSize: 10, color: COLORS.inkFaint }}>
              {story.url ? (
                <a
                  href={story.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{ color: COLORS.inkFaint, textDecoration: "none", borderBottom: "1px dotted #D0CCC6" }}
                >
                  {story.sources[0]} {"\u2197"}
                </a>
              ) : (
                <span>{story.sources[0]}</span>
              )}
              {story.sources.length > 1 && ` +${story.sources.length - 1}`}
            </div>

            {/* Expanded content — animated */}
            <div
              style={{
                maxHeight: isOpen ? 600 : 0,
                opacity: isOpen ? 1 : 0,
                overflow: "hidden",
                transition: "max-height 200ms ease, opacity 150ms ease",
              }}
            >
              <div style={{ paddingTop: 12 }}>
                {story.summary && (
                  <p
                    style={{
                      fontSize: 13,
                      fontFamily: FONTS.serif,
                      color: COLORS.inkSec,
                      lineHeight: 1.65,
                      margin: "0 0 10px",
                    }}
                  >
                    {story.summary}
                  </p>
                )}
                {story.trend && (
                  <div
                    style={{
                      fontSize: 11,
                      color: COLORS.forest,
                      fontWeight: 500,
                      marginBottom: 10,
                    }}
                  >
                    {story.trend}
                  </div>
                )}
                {story.whyItMatters && (
                  <div
                    style={{
                      background: COLORS.sageTint,
                      borderLeft: `2px solid ${COLORS.forest}`,
                      padding: "10px 14px",
                      borderRadius: "0 8px 8px 0",
                      marginBottom: 12,
                    }}
                  >
                    <Micro color={COLORS.forest} mb={4}>
                      Why it matters
                    </Micro>
                    <p
                      style={{
                        fontSize: 13,
                        fontFamily: FONTS.serif,
                        color: COLORS.ink,
                        lineHeight: 1.55,
                        margin: 0,
                      }}
                    >
                      {story.whyItMatters}
                    </p>
                  </div>
                )}
                {story.connectedStoryline && (
                  <div style={{ fontSize: 11, color: COLORS.inkMuted, marginBottom: 10, padding: "6px 10px", background: COLORS.borderLight, borderRadius: 6 }}>
                    <span style={{ fontWeight: 600 }}>Connected:</span> {story.connectedStoryline.title} {"\u2014"} {story.connectedStoryline.context}
                  </div>
                )}
                {story.url && (
                  <a
                    href={story.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      display: "inline-block",
                      fontSize: 11,
                      color: COLORS.forest,
                      fontWeight: 500,
                      textDecoration: "none",
                      borderBottom: `1px solid ${COLORS.sage}`,
                      marginBottom: 10,
                    }}
                  >
                    Read full article {"\u2197"}
                  </a>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
