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
            <div style={{ flex: 1 }}>
              <Micro color={sev.labelColor}>{story.sector}</Micro>
              <h3
                style={{
                  fontFamily: FONTS.serif,
                  fontSize: 14,
                  fontWeight: 400,
                  color: COLORS.ink,
                  lineHeight: 1.3,
                  margin: "3px 0 0",
                }}
              >
                {story.headline}
              </h3>
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
