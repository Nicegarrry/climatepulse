"use client";

import { COLORS, FONTS } from "@/lib/design-tokens";
import { SectorTag } from "./SectorTag";

export interface SavedClippingItem {
  id: string;
  raw_article_id: string;
  primary_domain: string;
  title: string;
  source_name: string;
  article_url: string;
  saved_at: string;
  note: string | null;
}

interface Props {
  item: SavedClippingItem;
  onRemove?: (rawArticleId: string) => void;
}

function formatSavedDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

export function SavedClipping({ item, onRemove }: Props) {
  return (
    <article
      style={{
        background: "transparent",
        padding: "12px 14px 16px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        cursor: "pointer",
      }}
      onClick={() => window.open(item.article_url, "_blank", "noopener,noreferrer")}
    >
      <span
        style={{
          fontFamily: FONTS.sans,
          fontSize: 10,
          letterSpacing: 0.4,
          textTransform: "uppercase",
          color: COLORS.plum,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {formatSavedDate(item.saved_at)}
      </span>
      <span
        style={{
          fontFamily: FONTS.sans,
          fontSize: 10,
          letterSpacing: 0.4,
          textTransform: "uppercase",
          color: COLORS.inkMuted,
        }}
      >
        {item.source_name}
      </span>
      <h3
        style={{
          margin: 0,
          fontFamily: FONTS.serif,
          fontSize: 15,
          lineHeight: 1.3,
          fontWeight: 500,
          color: COLORS.ink,
          paddingBottom: 4,
          borderBottom: `1px solid ${COLORS.borderLight}`,
        }}
      >
        {item.title}
      </h3>
      {item.note && (
        <p
          style={{
            margin: "2px 0 0 0",
            fontFamily: FONTS.serif,
            fontStyle: "italic",
            fontSize: 13,
            color: COLORS.inkSec,
            lineHeight: 1.4,
          }}
        >
          “{item.note}”
        </p>
      )}
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          marginTop: 4,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {item.primary_domain && <SectorTag domain={item.primary_domain} />}
        {onRemove && (
          <button
            onClick={() => onRemove(item.raw_article_id)}
            style={{
              marginLeft: "auto",
              background: "transparent",
              border: "none",
              fontFamily: FONTS.sans,
              fontSize: 10,
              color: COLORS.inkFaint,
              cursor: "pointer",
              padding: 0,
              letterSpacing: 0.3,
              textTransform: "uppercase",
            }}
          >
            Remove
          </button>
        )}
      </div>
    </article>
  );
}
