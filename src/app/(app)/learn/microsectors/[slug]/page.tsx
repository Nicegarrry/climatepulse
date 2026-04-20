import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import pool from "@/lib/db";
import { COLORS, FONTS } from "@/lib/design-tokens";
import {
  EditorialStatusBadge,
  type EditorialStatus,
} from "@/components/learn/editorial-status-badge";
import { ConceptTooltipScope } from "@/components/learn/inline-concept-tooltip";
import "@/components/learn/learn.css";
import {
  MicrosectorBlocks,
  type BriefBlock,
  type BlockType,
} from "./MicrosectorBlocks";

interface BriefHeaderRow {
  brief_id: string;
  microsector_id: number;
  title: string;
  tagline: string | null;
  regime_change_flagged: boolean;
  regime_change_source_ids: string[];
  regime_change_flagged_at: string | null;
  primary_domain: string | null;
  editorial_status: EditorialStatus;
  reviewed_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  microsector_name: string;
  microsector_description: string | null;
  microsector_deprecated_at: string | null;
  microsector_merged_into: number | null;
  successor_slug: string | null;
  sector_name: string;
  domain_slug: string | null;
  domain_name: string | null;
}

const BLOCK_ORDER: BlockType[] = [
  "nicks_lens",
  "fundamentals",
  "key_mechanisms",
  "australian_context",
  "current_state",
  "whats_moving",
  "watchlist",
  "related",
];

function blockIsEmpty(block: BriefBlock): boolean {
  const hasBody = !!(block.body && block.body.trim().length > 0);
  const hasJson =
    block.body_json !== null &&
    block.body_json !== undefined &&
    !(Array.isArray(block.body_json) && block.body_json.length === 0) &&
    !(
      typeof block.body_json === "object" &&
      !Array.isArray(block.body_json) &&
      Object.keys(block.body_json as Record<string, unknown>).length === 0
    );
  return !hasBody && !hasJson;
}

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

async function fetchBriefBySlug(slug: string): Promise<BriefHeaderRow | null> {
  const { rows } = await pool.query<BriefHeaderRow>(
    `SELECT
        mb.id AS brief_id,
        mb.microsector_id,
        mb.title,
        mb.tagline,
        mb.regime_change_flagged,
        mb.regime_change_source_ids,
        mb.regime_change_flagged_at,
        mb.primary_domain,
        mb.editorial_status,
        mb.reviewed_at,
        mb.version,
        mb.created_at,
        mb.updated_at,
        tm.name         AS microsector_name,
        tm.description  AS microsector_description,
        tm.deprecated_at AS microsector_deprecated_at,
        tm.merged_into  AS microsector_merged_into,
        succ.slug       AS successor_slug,
        ts.name         AS sector_name,
        td.slug         AS domain_slug,
        td.name         AS domain_name
      FROM taxonomy_microsectors tm
      JOIN taxonomy_sectors ts ON ts.id = tm.sector_id
      JOIN taxonomy_domains td ON td.id = ts.domain_id
      LEFT JOIN microsector_briefs mb ON mb.microsector_id = tm.id
      LEFT JOIN taxonomy_microsectors succ ON succ.id = tm.merged_into
      WHERE tm.slug = $1
      LIMIT 1`,
    [slug],
  );
  return rows[0] ?? null;
}

async function fetchBlocks(briefId: string): Promise<BriefBlock[]> {
  const { rows } = await pool.query<BriefBlock>(
    `SELECT
        id,
        brief_id,
        block_type,
        body,
        body_json,
        cadence_policy,
        last_generated_at,
        editorial_status,
        reviewed_at,
        version,
        updated_at
      FROM microsector_brief_blocks
      WHERE brief_id = $1
      ORDER BY block_type`,
    [briefId],
  );
  return rows;
}

export default async function MicrosectorBriefPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const header = await fetchBriefBySlug(slug);
  if (!header) notFound();

  // Deprecated + merged → redirect
  if (header.microsector_deprecated_at && header.successor_slug) {
    redirect(`/learn/microsectors/${header.successor_slug}`);
  }

  // No brief row for this microsector yet
  if (!header.brief_id) notFound();

  const blocksRaw = await fetchBlocks(header.brief_id);
  const blocks = blocksRaw.filter((b) => !blockIsEmpty(b));
  const byType = new Map<BlockType, BriefBlock>();
  for (const b of blocks) byType.set(b.block_type, b);

  const orderedBlocks: BriefBlock[] = BLOCK_ORDER.map((t) => byType.get(t)).filter(
    (b): b is BriefBlock => !!b,
  );

  // Low-signal variant detection
  const hasCurrent = !!byType.get("current_state");
  const hasMoving = !!byType.get("whats_moving");
  const lowSignalVariant = !hasCurrent && !hasMoving;

  const lowSignalTypes: BlockType[] = [
    "fundamentals",
    "key_mechanisms",
    "australian_context",
    "watchlist",
  ];
  const lowSignalBlocks: BriefBlock[] = lowSignalTypes
    .map((t) => byType.get(t))
    .filter((b): b is BriefBlock => !!b);

  const renderList: BriefBlock[] = lowSignalVariant ? lowSignalBlocks : orderedBlocks;

  const regimeFlaggedRel = relativeTime(header.regime_change_flagged_at);

  return (
    <div className="cp-learn">
      <div className="main-inner" style={{ paddingTop: 32, paddingBottom: 64 }}>
        {/* Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <Link
            href="/learn"
            className="micro"
            style={{ color: "var(--ink-3)", textDecoration: "none" }}
          >
            ← LEARN
          </Link>
          <span style={{ color: "var(--ink-5)" }}>/</span>
          <Link
            href="/learn/microsectors"
            className="micro"
            style={{ color: "var(--ink-3)", textDecoration: "none" }}
          >
            MICROSECTORS
          </Link>
          {header.domain_name && (
            <>
              <span style={{ color: "var(--ink-5)" }}>/</span>
              <span className="micro" style={{ color: "var(--ink-3)" }}>
                {header.domain_name.toUpperCase()}
              </span>
            </>
          )}
        </div>

        {/* Header */}
        <header style={{ marginBottom: 28 }}>
          <div
            className="micro"
            style={{ color: "var(--ink-4)", marginBottom: 8 }}
          >
            {header.sector_name.toUpperCase()}
          </div>
          <h1
            className="display-lg"
            style={{ color: "var(--ink)", margin: 0, marginBottom: 12 }}
          >
            {header.title || header.microsector_name}
          </h1>
          {header.tagline && (
            <p
              className="body-lg"
              style={{
                maxWidth: 680,
                margin: 0,
                color: "var(--ink-2)",
                fontStyle: "italic",
              }}
            >
              {header.tagline}
            </p>
          )}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginTop: 14,
              flexWrap: "wrap",
            }}
          >
            <EditorialStatusBadge
              status={header.editorial_status}
              timestamp={relativeTime(header.reviewed_at)}
            />
            <span
              className="meta tabular"
              style={{ color: "var(--ink-4)" }}
            >
              v{header.version} · updated {relativeTime(header.updated_at) ?? "—"}
            </span>
          </div>
        </header>

        {/* Regime-change banner */}
        {header.regime_change_flagged && (
          <div
            role="alert"
            style={{
              borderLeft: `3px solid ${COLORS.plum}`,
              background: COLORS.plumLight,
              padding: "14px 18px",
              marginBottom: 28,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div
              className="micro"
              style={{
                color: COLORS.plum,
                letterSpacing: "0.9px",
              }}
            >
              REGIME CHANGE FLAGGED
              {regimeFlaggedRel ? ` · ${regimeFlaggedRel}` : ""}
            </div>
            <div
              style={{
                fontFamily: FONTS.serif,
                fontSize: 16,
                lineHeight: 1.45,
                color: COLORS.plum,
              }}
            >
              A material policy or market shift has been flagged for this sector —
              review the <em>current state</em> block below for the implications.
            </div>
          </div>
        )}

        {/* Low-signal note */}
        {lowSignalVariant && (
          <div
            style={{
              background: "var(--paper-dark)",
              border: "1px solid var(--border)",
              padding: "12px 16px",
              marginBottom: 28,
              color: "var(--ink-3)",
              fontFamily: FONTS.sans,
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            <strong style={{ color: "var(--ink-2)" }}>Quarterly pulse.</strong>{" "}
            This sector has low recent signal volume — showing stable foundations
            only. Current-state and what&apos;s-moving blocks will re-appear once
            fresh substrate lands.
          </div>
        )}

        {/* Blocks */}
        <ConceptTooltipScope>
          <MicrosectorBlocks blocks={renderList} />
        </ConceptTooltipScope>

        {/* Footer */}
        <footer
          style={{
            marginTop: 56,
            paddingTop: 18,
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <span
            className="meta tabular"
            style={{ color: "var(--ink-4)" }}
          >
            Brief v{header.version} · {header.microsector_id}
          </span>
          <span
            className="micro"
            style={{ color: "var(--ink-4)" }}
            title="Editor controls live in the Editor tab."
          >
            EDIT (coming soon)
          </span>
        </footer>
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";
