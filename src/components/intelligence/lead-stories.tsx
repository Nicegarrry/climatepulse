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
  // First story starts expanded
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
              background: isOpen ? COLORS.paperDark : COLORS.surface,
              border: `1px solid ${isOpen ? COLORS.border : COLORS.borderLight}`,
              borderLeft: isLead
                ? `3px solid ${COLORS.ink}`
                : `2px solid ${sev.borderColor}`,
              borderRadius: isLead ? "0 8px 8px 0" : 8,
              padding: isLead ? "18px 20px 18px 18px" : "14px 20px 14px 16px",
              marginBottom: 8,
              cursor: "pointer",
              marginLeft: isLead ? -4 : 0,
              transition: "background 150ms ease, border-color 150ms ease",
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
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                {isLead && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: 1.2,
                      textTransform: "uppercase",
                      color: COLORS.plum,
                    }}
                  >
                    Lead
                  </span>
                )}
                <Micro color={sev.labelColor}>{story.sector}</Micro>
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
                {/* Expand indicator */}
                <span
                  style={{
                    fontSize: 11,
                    color: COLORS.inkFaint,
                    transition: "transform 150ms ease",
                    display: "inline-block",
                    transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
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

            {/* Expanded content */}
            {isOpen && (
              <div style={{ marginTop: 12 }}>
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
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <Micro color={COLORS.inkFaint}>Sources</Micro>
                  {story.sources.map((s, i) => (
                    <SourceTag key={i} name={s} type={story.sourceTypes?.[i]} />
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
