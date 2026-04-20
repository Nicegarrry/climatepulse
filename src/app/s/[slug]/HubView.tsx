/**
 * HubView — hub-template surface renderer.
 *
 * Sections (reorderable via surface.layout.order):
 *   - intro            — overlay.introduction + overlay.editor_note pull-quote
 *   - feed             — retrieveContent bounded by scope
 *   - featured_paths   — learning paths intersecting scope.microsector_ids
 *   - browse           — scope microsectors grouped by domain
 *   - search           — link to /s/[slug]/search
 *
 * Custom modules (overlay.custom_modules) render at the end in `position`
 * order; they don't participate in the layout.order re-ordering because
 * the editor hasn't indicated a specific slot.
 */
import Link from "next/link";
import {
  MagnifyingGlassIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";
import type { CSSProperties } from "react";
import pool from "@/lib/db";
import { COLORS, FONTS } from "@/lib/design-tokens";
import { retrieveContent, type RetrievedContent } from "@/lib/intelligence/retriever";
import type { ContentType } from "@/lib/intelligence/embedder";
import {
  buildScopedFilters,
  defaultContentTypes,
} from "@/lib/surfaces/scope-filter";
import {
  EditorialStatusBadge,
  type EditorialStatus,
} from "@/components/learn/editorial-status-badge";
import type { AccessDecision, KnowledgeSurface, SurfaceLayout } from "@/lib/surfaces/types";

const FEED_CONTENT_TYPES: ContentType[] = [
  "article",
  "daily_digest",
  "podcast",
  "weekly_digest",
  "concept_card",
];

type SectionKey = NonNullable<SurfaceLayout["order"]>[number];
const DEFAULT_ORDER: SectionKey[] = ["intro", "feed", "featured_paths", "browse"];

interface HubViewProps {
  surface: KnowledgeSurface;
  decision: AccessDecision;
  viewerUserId: string | null;
}

interface FeaturedPath {
  id: string;
  slug: string;
  title: string;
  goal: string | null;
  editorial_status: EditorialStatus | null;
}

interface BrowseMicrosector {
  id: number;
  slug: string;
  name: string;
  domain_slug: string;
  domain_name: string;
}

export async function HubView({ surface, decision: _decision, viewerUserId: _viewerUserId }: HubViewProps) {
  const showSearch = surface.layout.show_search !== false;
  const showFeed = surface.layout.show_feed !== false;
  const showBrowse = surface.layout.show_browse !== false;

  // Build scoped filters once.
  const scoped = await buildScopedFilters(surface);
  const defaultTypes = defaultContentTypes(surface);
  const feedTypes = FEED_CONTENT_TYPES.filter((t) =>
    defaultTypes.includes(t),
  ) as ContentType[];

  // Feed — query only when the section is enabled.
  let feed: RetrievedContent[] = [];
  if (showFeed) {
    try {
      feed = await retrieveContent(
        surface.title,
        { ...scoped, content_types: feedTypes },
        { limit: 20, dedupeBySource: true },
      );
    } catch (err) {
      console.error("[s/slug/HubView] feed retrieve failed:", err);
      feed = [];
    }
  }

  // Featured paths — intersecting microsectors.
  const featuredPaths = await fetchFeaturedPaths(surface.scope.microsector_ids ?? []);

  // Browse — microsectors grouped by domain.
  const browseGroups = showBrowse
    ? await fetchBrowseMicrosectors(surface.scope.microsector_ids ?? [])
    : [];

  const ordered: SectionKey[] = surface.layout.order?.length
    ? surface.layout.order
    : DEFAULT_ORDER;

  const sectionEl: Record<SectionKey, React.ReactNode> = {
    intro: <IntroSection key="intro" surface={surface} />,
    feed: showFeed ? (
      <FeedSection key="feed" items={feed} surface={surface} />
    ) : null,
    featured_paths:
      featuredPaths.length > 0 ? (
        <FeaturedPathsSection key="featured_paths" paths={featuredPaths} />
      ) : null,
    browse:
      showBrowse && browseGroups.length > 0 ? (
        <BrowseSection key="browse" groups={browseGroups} />
      ) : null,
    search: null,
  };

  const rendered: React.ReactNode[] = [];
  const seen = new Set<SectionKey>();
  for (const key of ordered) {
    if (seen.has(key)) continue;
    seen.add(key);
    const node = sectionEl[key];
    if (node) rendered.push(node);
  }
  for (const key of DEFAULT_ORDER) {
    if (seen.has(key)) continue;
    const node = sectionEl[key];
    if (node) rendered.push(node);
  }

  return (
    <div
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "56px 28px 96px",
      }}
    >
      <SurfaceHeader surface={surface} showSearch={showSearch} />
      {rendered}
      <CustomModulesSection surface={surface} />
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

function SurfaceHeader({
  surface,
  showSearch,
}: {
  surface: KnowledgeSurface;
  showSearch: boolean;
}) {
  return (
    <header
      style={{
        borderBottom: `1px solid ${COLORS.border}`,
        paddingBottom: 20,
        marginBottom: 32,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div>
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: COLORS.inkMuted,
            marginBottom: 10,
          }}
        >
          ClimatePulse · Knowledge Surface
        </div>
        <h1
          style={{
            fontFamily: FONTS.serif,
            fontSize: 44,
            lineHeight: 1.05,
            fontWeight: 500,
            margin: 0,
            letterSpacing: "-0.5px",
            color: "var(--surface-primary, " + COLORS.forest + ")",
          }}
        >
          {surface.title}
        </h1>
      </div>
      {showSearch && (
        <Link
          href={`/s/${surface.slug}/search`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: COLORS.inkSec,
            padding: "8px 14px",
            border: `1px solid ${COLORS.border}`,
            background: COLORS.surface,
            textDecoration: "none",
          }}
        >
          <MagnifyingGlassIcon width={14} height={14} strokeWidth={1.6} />
          Search this surface
        </Link>
      )}
    </header>
  );
}

// ─── Intro ────────────────────────────────────────────────────────────────────

function IntroSection({ surface }: { surface: KnowledgeSurface }) {
  const intro = surface.overlay.introduction?.trim();
  const note = surface.overlay.editor_note?.trim();
  if (!intro && !note) return null;
  return (
    <section style={{ marginBottom: 48 }}>
      {intro &&
        intro.split(/\n{2,}/).map((p, i) => (
          <p
            key={i}
            style={{
              fontFamily: FONTS.serif,
              fontSize: 19,
              lineHeight: 1.55,
              color: COLORS.ink,
              margin: i === 0 ? "0 0 16px" : "0 0 16px",
              maxWidth: 680,
            }}
          >
            {p}
          </p>
        ))}
      {note && (
        <blockquote
          style={{
            margin: "24px 0 0",
            padding: "16px 20px",
            borderLeft: `3px solid var(--surface-accent, ${COLORS.plum})`,
            background: COLORS.paperDark,
            fontFamily: FONTS.serif,
            fontSize: 15,
            fontStyle: "italic",
            color: COLORS.inkSec,
            lineHeight: 1.5,
          }}
        >
          {note}
        </blockquote>
      )}
    </section>
  );
}

// ─── Feed ─────────────────────────────────────────────────────────────────────

function FeedSection({
  items,
  surface: _surface,
}: {
  items: RetrievedContent[];
  surface: KnowledgeSurface;
}) {
  if (items.length === 0) {
    return (
      <section style={{ marginBottom: 48 }}>
        <SectionLabel>Feed</SectionLabel>
        <div
          style={{
            color: COLORS.inkMuted,
            fontSize: 13,
            padding: "12px 0",
          }}
        >
          No matching content yet. Check back soon.
        </div>
      </section>
    );
  }

  return (
    <section style={{ marginBottom: 48 }}>
      <SectionLabel>Feed · {items.length}</SectionLabel>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {items.map((item) => (
          <li
            key={`${item.content_type}:${item.source_id}:${item.chunk_index}`}
            style={{
              display: "grid",
              gridTemplateColumns: "110px 1fr",
              gap: 16,
              padding: "12px 0",
              borderBottom: `1px solid ${COLORS.borderLight}`,
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: COLORS.inkMuted,
                fontVariantNumeric: "tabular-nums",
                paddingTop: 3,
                letterSpacing: "0.02em",
              }}
            >
              {formatDate(item.published_at)}
            </div>
            <div style={{ minWidth: 0 }}>
              <FeedTitle item={item} />
              {item.subtitle && (
                <div
                  style={{
                    fontSize: 11,
                    color: COLORS.inkMuted,
                    marginTop: 4,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  {item.subtitle}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FeedTitle({ item }: { item: RetrievedContent }) {
  const href = feedHref(item);
  const titleEl = (
    <span
      style={{
        fontFamily: FONTS.serif,
        fontSize: 17,
        lineHeight: 1.3,
        color: COLORS.ink,
        fontWeight: 500,
      }}
    >
      {item.title}
    </span>
  );
  const content = (
    <span
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: 8,
        flexWrap: "wrap",
      }}
    >
      {titleEl}
      {item.editorial_status && (
        <EditorialStatusBadge
          status={item.editorial_status as EditorialStatus}
          compact
        />
      )}
    </span>
  );
  if (!href) return content;
  return (
    <Link
      href={href}
      style={{ textDecoration: "none" }}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noreferrer" : undefined}
    >
      {content}
    </Link>
  );
}

function feedHref(item: RetrievedContent): string | null {
  if (item.content_type === "concept_card" && item.slug) {
    return `/learn/concepts/${item.slug}`;
  }
  if (item.content_type === "article" && item.url) return item.url;
  if (item.content_type === "podcast") return "/dashboard?tab=intelligence";
  if (item.content_type === "daily_digest") return "/dashboard?tab=intelligence";
  if (item.content_type === "weekly_digest") return "/dashboard?tab=weekly";
  return null;
}

// ─── Featured paths ───────────────────────────────────────────────────────────

async function fetchFeaturedPaths(microsectorIds: number[]): Promise<FeaturedPath[]> {
  try {
    if (microsectorIds.length === 0) {
      const { rows } = await pool.query<FeaturedPath>(
        `SELECT id, slug, title, goal, editorial_status::text AS editorial_status
           FROM learning_paths
          WHERE editorial_status IN ('editor_authored','editor_reviewed','user_generated')
          ORDER BY updated_at DESC
          LIMIT 6`,
      );
      return rows;
    }
    const idStrings = microsectorIds.map((id) => String(id));
    const { rows } = await pool.query<FeaturedPath>(
      `SELECT id, slug, title, goal, editorial_status::text AS editorial_status
         FROM learning_paths
        WHERE editorial_status IN ('editor_authored','editor_reviewed','user_generated')
          AND (
            scope IS NULL
            OR scope->'in_scope_microsectors' IS NULL
            OR (scope->'in_scope_microsectors') ?| $1::text[]
          )
        ORDER BY updated_at DESC
        LIMIT 6`,
      [idStrings],
    );
    return rows;
  } catch (err) {
    console.error("[s/slug/HubView] fetchFeaturedPaths failed:", err);
    return [];
  }
}

function FeaturedPathsSection({ paths }: { paths: FeaturedPath[] }) {
  return (
    <section style={{ marginBottom: 48 }}>
      <SectionLabel>Featured learning paths</SectionLabel>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        {paths.map((p) => (
          <Link
            key={p.id}
            href={`/learn/paths/${p.slug}`}
            style={{
              display: "block",
              padding: 16,
              border: `1px solid ${COLORS.border}`,
              background: COLORS.surface,
              textDecoration: "none",
              color: COLORS.ink,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 8,
                marginBottom: 6,
              }}
            >
              {p.editorial_status && (
                <EditorialStatusBadge
                  status={p.editorial_status as EditorialStatus}
                  compact
                />
              )}
            </div>
            <div
              style={{
                fontFamily: FONTS.serif,
                fontSize: 18,
                lineHeight: 1.25,
                fontWeight: 500,
                marginBottom: 6,
              }}
            >
              {p.title}
            </div>
            {p.goal && (
              <div
                style={{
                  fontSize: 13,
                  color: COLORS.inkSec,
                  lineHeight: 1.5,
                }}
              >
                {p.goal.length > 120 ? p.goal.slice(0, 120) + "…" : p.goal}
              </div>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}

// ─── Browse ───────────────────────────────────────────────────────────────────

async function fetchBrowseMicrosectors(
  microsectorIds: number[],
): Promise<BrowseMicrosector[]> {
  if (microsectorIds.length === 0) return [];
  try {
    const { rows } = await pool.query<BrowseMicrosector>(
      `SELECT tm.id, tm.slug, tm.name,
              td.slug AS domain_slug, td.name AS domain_name
         FROM taxonomy_microsectors tm
         JOIN taxonomy_sectors ts ON ts.id = tm.sector_id
         JOIN taxonomy_domains td ON td.id = ts.domain_id
        WHERE tm.id = ANY($1::int[])
        ORDER BY td.name, tm.name`,
      [microsectorIds],
    );
    return rows;
  } catch (err) {
    console.error("[s/slug/HubView] fetchBrowseMicrosectors failed:", err);
    return [];
  }
}

function BrowseSection({ groups }: { groups: BrowseMicrosector[] }) {
  const byDomain = new Map<string, { name: string; items: BrowseMicrosector[] }>();
  for (const m of groups) {
    if (!byDomain.has(m.domain_slug)) {
      byDomain.set(m.domain_slug, { name: m.domain_name, items: [] });
    }
    byDomain.get(m.domain_slug)!.items.push(m);
  }
  return (
    <section style={{ marginBottom: 48 }}>
      <SectionLabel>Browse microsectors</SectionLabel>
      <div style={{ display: "grid", gap: 20 }}>
        {Array.from(byDomain.entries()).map(([slug, group]) => (
          <div key={slug}>
            <div
              style={{
                fontFamily: FONTS.sans,
                fontSize: 11,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--surface-primary, " + COLORS.forest + ")",
                marginBottom: 8,
              }}
            >
              {group.name}
            </div>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              {group.items.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/learn/microsectors/${m.slug}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 12,
                      padding: "4px 10px",
                      border: `1px solid ${COLORS.border}`,
                      color: COLORS.inkSec,
                      textDecoration: "none",
                      background: COLORS.surface,
                    }}
                  >
                    {m.name}
                    <ArrowRightIcon width={10} height={10} strokeWidth={1.6} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Custom modules ───────────────────────────────────────────────────────────

function CustomModulesSection({ surface }: { surface: KnowledgeSurface }) {
  const modules = surface.overlay.custom_modules;
  if (!modules || modules.length === 0) return null;
  const ordered = [...modules].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0),
  );
  return (
    <section style={{ marginTop: 16, marginBottom: 48 }}>
      {ordered.map((m) => (
        <article
          key={m.id}
          style={{
            padding: "24px 0",
            borderTop: `1px solid ${COLORS.border}`,
          }}
        >
          <h2
            style={{
              fontFamily: FONTS.serif,
              fontSize: 24,
              margin: "0 0 10px",
              fontWeight: 500,
              color: COLORS.ink,
            }}
          >
            {m.title}
          </h2>
          {m.body && (
            <div
              style={{
                fontFamily: FONTS.serif,
                fontSize: 16,
                lineHeight: 1.6,
                color: COLORS.inkSec,
                whiteSpace: "pre-wrap",
              }}
            >
              {m.body}
            </div>
          )}
        </article>
      ))}
    </section>
  );
}

// ─── Shared bits ──────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  const style: CSSProperties = {
    fontFamily: FONTS.sans,
    fontSize: 11,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: COLORS.inkMuted,
    borderBottom: `1px solid ${COLORS.border}`,
    paddingBottom: 8,
    marginBottom: 16,
  };
  return <h2 style={style}>{children}</h2>;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const now = Date.now();
    const diff = now - d.getTime();
    const day = 86_400_000;
    if (diff < day) return "today";
    if (diff < 2 * day) return "yesterday";
    if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
    return d.toISOString().slice(0, 10);
  } catch {
    return "—";
  }
}
