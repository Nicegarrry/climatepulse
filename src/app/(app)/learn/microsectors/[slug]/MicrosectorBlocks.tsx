"use client";

import { useState } from "react";
import Link from "next/link";
import { COLORS, FONTS } from "@/lib/design-tokens";
import {
  EditorialStatusBadge,
  type EditorialStatus,
} from "@/components/learn/editorial-status-badge";
import { ProseWithTooltips } from "@/components/learn/render-prose-with-tooltips";

export type BlockType =
  | "nicks_lens"
  | "fundamentals"
  | "key_mechanisms"
  | "australian_context"
  | "current_state"
  | "whats_moving"
  | "watchlist"
  | "related";

export type CadencePolicy =
  | "manual"
  | "daily"
  | "weekly"
  | "quarterly"
  | "yearly";

export interface BriefBlock {
  id: string;
  brief_id: string;
  block_type: BlockType;
  body: string | null;
  body_json: unknown;
  cadence_policy: CadencePolicy;
  last_generated_at: string | null;
  editorial_status: EditorialStatus;
  reviewed_at: string | null;
  version: number;
  updated_at: string;
}

export interface RelatedItem {
  microsector_id: number;
  microsector_slug: string;
  microsector_name: string;
  proximity: "sector_sibling" | "domain_peer" | "co_mentioned";
  co_mention_count: number;
}

const BLOCK_LABELS: Record<BlockType, string> = {
  nicks_lens: "Editor's view",
  fundamentals: "Fundamentals",
  key_mechanisms: "Key mechanisms",
  australian_context: "Australian context",
  current_state: "Current state",
  whats_moving: "What's moving",
  watchlist: "Watchlist",
  related: "Related microsectors",
};

function relativeTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const now = Date.now();
  const diffSec = Math.max(1, Math.round((now - then) / 1000));
  if (diffSec < 60) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 48) return diffHr === 1 ? "1 hour ago" : `${diffHr} hours ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return diffDay === 1 ? "1 day ago" : `${diffDay} days ago`;
  const diffMo = Math.round(diffDay / 30);
  if (diffMo < 18) return diffMo === 1 ? "1 month ago" : `${diffMo} months ago`;
  const diffYr = Math.round(diffMo / 12);
  return diffYr === 1 ? "1 year ago" : `${diffYr} years ago`;
}

function splitParagraphs(body: string | null | undefined): string[] {
  if (!body) return [];
  return body
    .split(/\n\s*\n/g)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

export function MicrosectorBlocks({ blocks }: { blocks: BriefBlock[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
      {blocks.map((b) => (
        <BlockSection key={b.id} block={b} />
      ))}
    </div>
  );
}

function BlockSection({ block }: { block: BriefBlock }) {
  const label = BLOCK_LABELS[block.block_type];
  const rel = relativeTime(block.last_generated_at);
  const isNicks = block.block_type === "nicks_lens";

  return (
    <section
      style={{
        paddingTop: 24,
        borderTop: "1px solid var(--border)",
      }}
    >
      {/* Block header */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h2
            style={{
              fontFamily: isNicks ? FONTS.serif : FONTS.serif,
              fontWeight: isNicks ? 500 : 420,
              fontSize: isNicks ? 24 : 22,
              letterSpacing: "-0.2px",
              color: "var(--ink)",
              margin: 0,
              fontStyle: isNicks ? "italic" : undefined,
            }}
          >
            {label}
          </h2>
          {isNicks && (
            <span
              className="micro"
              style={{
                background: COLORS.plumLight,
                color: COLORS.plum,
                padding: "2px 6px",
                letterSpacing: "0.08em",
              }}
            >
              EDITOR&apos;S VIEW
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <EditorialStatusBadge
            status={block.editorial_status}
            timestamp={rel}
            compact
          />
          <span
            className="micro tabular"
            style={{ color: "var(--ink-4)" }}
          >
            {block.cadence_policy.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Body */}
      <BlockBody block={block} />
    </section>
  );
}

function BlockBody({ block }: { block: BriefBlock }) {
  switch (block.block_type) {
    case "nicks_lens":
      return <NicksLensBody body={block.body} />;
    case "fundamentals":
    case "australian_context":
    case "current_state":
      return <ProseBody body={block.body} />;
    case "key_mechanisms":
      return <KeyMechanismsBody body={block.body} bodyJson={block.body_json} />;
    case "whats_moving":
      return <WhatsMovingBody body={block.body} bodyJson={block.body_json} />;
    case "watchlist":
      return <WatchlistBody body={block.body} bodyJson={block.body_json} />;
    case "related":
      return <RelatedBody bodyJson={block.body_json} />;
    default:
      return <ProseBody body={block.body} />;
  }
}

/* --------------------------------- renderers -------------------------------- */

function ProseBody({ body }: { body: string | null }) {
  const paragraphs = splitParagraphs(body);
  if (paragraphs.length === 0) {
    return (
      <p style={{ color: "var(--ink-4)", fontFamily: FONTS.sans, fontSize: 13 }}>
        Not yet written.
      </p>
    );
  }
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        maxWidth: 680,
      }}
    >
      <ProseWithTooltips
        body={paragraphs.join("\n\n")}
        paragraphStyle={{
          fontFamily: FONTS.serif,
          fontSize: 17,
          lineHeight: 1.6,
          color: "var(--ink-2)",
          margin: 0,
        }}
      />
    </div>
  );
}

function NicksLensBody({ body }: { body: string | null }) {
  const paragraphs = splitParagraphs(body);
  if (paragraphs.length === 0) {
    return (
      <p style={{ color: "var(--ink-4)", fontFamily: FONTS.sans, fontSize: 13 }}>
        Editor hasn&apos;t weighed in yet.
      </p>
    );
  }
  return (
    <blockquote
      style={{
        borderLeft: `2px solid ${COLORS.plum}`,
        paddingLeft: 18,
        margin: 0,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        maxWidth: 680,
      }}
    >
      <ProseWithTooltips
        body={paragraphs.join("\n\n")}
        paragraphStyle={{
          fontFamily: FONTS.serif,
          fontSize: 19,
          lineHeight: 1.55,
          color: COLORS.ink,
          margin: 0,
          fontStyle: "italic",
        }}
      />
    </blockquote>
  );
}

interface MechanismItem {
  title?: string;
  body?: string;
}

function KeyMechanismsBody({
  body,
  bodyJson,
}: {
  body: string | null;
  bodyJson: unknown;
}) {
  const items = parseMechanismList(bodyJson);
  if (items.length > 0) {
    return (
      <dl
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 18,
          maxWidth: 680,
          margin: 0,
        }}
      >
        {items.map((m, i) => (
          <div key={i}>
            {m.title && (
              <dt
                style={{
                  fontFamily: FONTS.serif,
                  fontSize: 17,
                  fontWeight: 500,
                  color: "var(--ink)",
                  marginBottom: 4,
                }}
              >
                {m.title}
              </dt>
            )}
            {m.body && (
              <dd
                style={{
                  fontFamily: FONTS.serif,
                  fontSize: 16,
                  lineHeight: 1.55,
                  color: "var(--ink-2)",
                  margin: 0,
                }}
              >
                {m.body}
              </dd>
            )}
          </div>
        ))}
      </dl>
    );
  }
  // fallback
  return <ProseBody body={body} />;
}

function parseMechanismList(bodyJson: unknown): MechanismItem[] {
  if (!bodyJson) return [];
  if (Array.isArray(bodyJson)) {
    const out: MechanismItem[] = [];
    for (const raw of bodyJson) {
      if (typeof raw === "string") {
        if (raw.trim()) out.push({ body: raw });
        continue;
      }
      if (raw && typeof raw === "object") {
        const r = raw as Record<string, unknown>;
        const item: MechanismItem = {
          title: typeof r.title === "string" ? r.title : undefined,
          body: typeof r.body === "string" ? r.body : undefined,
        };
        if (item.title || item.body) out.push(item);
      }
    }
    return out;
  }
  if (typeof bodyJson === "object") {
    const obj = bodyJson as Record<string, unknown>;
    const maybeItems = obj.items;
    if (Array.isArray(maybeItems)) return parseMechanismList(maybeItems);
  }
  return [];
}

function WhatsMovingBody({
  body,
  bodyJson,
}: {
  body: string | null;
  bodyJson: unknown;
}) {
  const items = parsePointerList(bodyJson);
  if (items.length > 0) {
    return (
      <ul
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          maxWidth: 680,
          margin: 0,
          padding: 0,
          listStyle: "none",
        }}
      >
        {items.map((item, i) => (
          <li
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "8px 1fr",
              gap: 10,
              alignItems: "baseline",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: COLORS.forestMid,
                display: "block",
                transform: "translateY(2px)",
              }}
            />
            <div>
              {item.title && (
                <div
                  style={{
                    fontFamily: FONTS.serif,
                    fontSize: 17,
                    fontWeight: 500,
                    lineHeight: 1.35,
                    color: "var(--ink)",
                    marginBottom: 2,
                  }}
                >
                  {item.title}
                </div>
              )}
              {item.body && (
                <div
                  style={{
                    fontFamily: FONTS.serif,
                    fontSize: 15,
                    lineHeight: 1.55,
                    color: "var(--ink-2)",
                  }}
                >
                  {item.body}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    );
  }
  return <ProseBody body={body} />;
}

function parsePointerList(bodyJson: unknown): MechanismItem[] {
  if (!bodyJson) return [];
  if (Array.isArray(bodyJson)) {
    const out: MechanismItem[] = [];
    for (const raw of bodyJson) {
      if (typeof raw === "string") {
        if (raw.trim()) out.push({ body: raw });
        continue;
      }
      if (raw && typeof raw === "object") {
        const r = raw as Record<string, unknown>;
        const title =
          typeof r.title === "string"
            ? r.title
            : typeof r.headline === "string"
              ? r.headline
              : typeof r.label === "string"
                ? r.label
                : undefined;
        const body =
          typeof r.body === "string"
            ? r.body
            : typeof r.summary === "string"
              ? r.summary
              : typeof r.description === "string"
                ? r.description
                : typeof r.detail === "string"
                  ? r.detail
                  : undefined;
        const item: MechanismItem = { title, body };
        if (item.title || item.body) out.push(item);
      }
    }
    return out;
  }
  if (typeof bodyJson === "object") {
    const obj = bodyJson as Record<string, unknown>;
    if (Array.isArray(obj.items)) return parsePointerList(obj.items);
  }
  return [];
}

interface WatchItem {
  title?: string;
  body?: string;
  date?: string;
}

function WatchlistBody({
  body,
  bodyJson,
}: {
  body: string | null;
  bodyJson: unknown;
}) {
  const items = parseWatchlist(bodyJson);
  if (items.length > 0) {
    return (
      <ol
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 0,
          maxWidth: 680,
          margin: 0,
          padding: 0,
          listStyle: "none",
          borderTop: "1px solid var(--border)",
        }}
      >
        {items.map((item, i) => (
          <li
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "120px 1fr",
              gap: 16,
              padding: "14px 0",
              borderBottom: "1px solid var(--border)",
              alignItems: "baseline",
            }}
          >
            <span
              className="micro tabular"
              style={{
                color: item.date ? "var(--ink-2)" : "var(--ink-4)",
              }}
            >
              {item.date || "UPCOMING"}
            </span>
            <div>
              {item.title && (
                <div
                  style={{
                    fontFamily: FONTS.serif,
                    fontSize: 17,
                    lineHeight: 1.4,
                    color: "var(--ink)",
                    fontWeight: 420,
                    marginBottom: item.body ? 4 : 0,
                  }}
                >
                  {item.title}
                </div>
              )}
              {item.body && (
                <div
                  style={{
                    fontFamily: FONTS.sans,
                    fontSize: 14,
                    lineHeight: 1.5,
                    color: "var(--ink-3)",
                  }}
                >
                  {item.body}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    );
  }
  return <ProseBody body={body} />;
}

function parseWatchlist(bodyJson: unknown): WatchItem[] {
  if (!bodyJson) return [];
  if (Array.isArray(bodyJson)) {
    const out: WatchItem[] = [];
    for (const raw of bodyJson) {
      if (typeof raw === "string") {
        if (raw.trim()) out.push({ title: raw });
        continue;
      }
      if (raw && typeof raw === "object") {
        const r = raw as Record<string, unknown>;
        const title =
          typeof r.title === "string"
            ? r.title
            : typeof r.event === "string"
              ? r.event
              : typeof r.headline === "string"
                ? r.headline
                : undefined;
        const body =
          typeof r.body === "string"
            ? r.body
            : typeof r.note === "string"
              ? r.note
              : typeof r.description === "string"
                ? r.description
                : undefined;
        const date =
          typeof r.date === "string"
            ? r.date
            : typeof r.when === "string"
              ? r.when
              : typeof r.due === "string"
                ? r.due
                : undefined;
        const item: WatchItem = { title, body, date };
        if (item.title || item.body) out.push(item);
      }
    }
    return out;
  }
  if (typeof bodyJson === "object") {
    const obj = bodyJson as Record<string, unknown>;
    if (Array.isArray(obj.items)) return parseWatchlist(obj.items);
  }
  return [];
}

function RelatedBody({ bodyJson }: { bodyJson: unknown }) {
  const items = parseRelated(bodyJson);
  if (items.length === 0) {
    return (
      <p style={{ color: "var(--ink-4)", fontFamily: FONTS.sans, fontSize: 13 }}>
        No related microsectors identified yet.
      </p>
    );
  }
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: 10,
      }}
    >
      {items.map((item) => (
        <Link
          key={`${item.microsector_id}-${item.proximity}`}
          href={`/learn/microsectors/${item.microsector_slug}`}
          style={{
            display: "block",
            padding: "10px 12px",
            border: "1px solid var(--border)",
            background: "var(--surface)",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <div
            className="micro"
            style={{ color: "var(--ink-4)", marginBottom: 4 }}
          >
            {proximityLabel(item.proximity)}
            {item.proximity === "co_mentioned" && item.co_mention_count > 0
              ? ` · ${item.co_mention_count}×`
              : ""}
          </div>
          <div
            style={{
              fontFamily: FONTS.serif,
              fontSize: 15,
              lineHeight: 1.3,
              color: "var(--ink)",
            }}
          >
            {item.microsector_name}
          </div>
        </Link>
      ))}
    </div>
  );
}

function proximityLabel(
  p: "sector_sibling" | "domain_peer" | "co_mentioned",
): string {
  switch (p) {
    case "sector_sibling":
      return "SISTER";
    case "domain_peer":
      return "SAME DOMAIN";
    case "co_mentioned":
      return "CO-MENTIONED";
  }
}

function parseRelated(bodyJson: unknown): RelatedItem[] {
  if (!bodyJson) return [];
  let arr: unknown[] = [];
  if (Array.isArray(bodyJson)) {
    arr = bodyJson;
  } else if (typeof bodyJson === "object") {
    const obj = bodyJson as Record<string, unknown>;
    if (Array.isArray(obj.items)) arr = obj.items;
  }
  return arr
    .map((raw) => {
      if (!raw || typeof raw !== "object") return null;
      const r = raw as Record<string, unknown>;
      const id = typeof r.microsector_id === "number" ? r.microsector_id : null;
      const slug =
        typeof r.microsector_slug === "string" ? r.microsector_slug : null;
      const name =
        typeof r.microsector_name === "string" ? r.microsector_name : null;
      const proximity = r.proximity;
      if (
        id === null ||
        slug === null ||
        name === null ||
        (proximity !== "sector_sibling" &&
          proximity !== "domain_peer" &&
          proximity !== "co_mentioned")
      ) {
        return null;
      }
      const co =
        typeof r.co_mention_count === "number" ? r.co_mention_count : 0;
      return {
        microsector_id: id,
        microsector_slug: slug,
        microsector_name: name,
        proximity,
        co_mention_count: co,
      } satisfies RelatedItem;
    })
    .filter((r): r is RelatedItem => r !== null);
}
