"use client";

import { COLORS, FONTS, SEVERITY } from "@/lib/design-tokens";
import type { EditorialStory } from "@/lib/mock-editorial";
import { Micro } from "./primitives";

export function AlsoToday({ stories }: { stories: EditorialStory[] }) {
  return (
    <div>
      {stories.map((story) => {
        const sev = SEVERITY[story.severity] || SEVERITY.watch;
        return (
          <div
            key={story.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              padding: "10px 0",
              borderBottom: `1px solid ${COLORS.borderLight}`,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
                <Micro color={sev.labelColor}>{story.sector}</Micro>
                <span style={{ fontSize: 9, color: COLORS.inkFaint }}>{story.sources[0]}</span>
              </div>
              {story.url ? (
                <a
                  href={story.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: "none" }}
                >
                  <h3
                    style={{
                      fontFamily: FONTS.serif,
                      fontSize: 14,
                      fontWeight: 400,
                      color: COLORS.ink,
                      lineHeight: 1.3,
                      margin: 0,
                    }}
                  >
                    {story.headline}
                    <span style={{ fontSize: 10, color: COLORS.inkFaint, marginLeft: 6 }}>{"\u2197"}</span>
                  </h3>
                </a>
              ) : (
                <h3
                  style={{
                    fontFamily: FONTS.serif,
                    fontSize: 14,
                    fontWeight: 400,
                    color: COLORS.ink,
                    lineHeight: 1.3,
                    margin: 0,
                  }}
                >
                  {story.headline}
                </h3>
              )}
              {story.summary && (
                <p style={{ fontSize: 11, color: COLORS.inkMuted, margin: "3px 0 0", lineHeight: 1.4 }}>
                  {story.summary}
                </p>
              )}
            </div>
            {story.number && (
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: COLORS.ink,
                  fontVariantNumeric: "tabular-nums",
                  flexShrink: 0,
                  marginLeft: 12,
                }}
              >
                {story.number}
                <span style={{ fontSize: 9, color: COLORS.inkMuted, marginLeft: 2 }}>
                  {story.unit}
                </span>
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
