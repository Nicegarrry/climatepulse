import Link from "next/link";
import { notFound } from "next/navigation";
import pool from "@/lib/db";
import { COLORS, FONTS } from "@/lib/design-tokens";
import {
  EditorialStatusBadge,
  type EditorialStatus,
} from "@/components/learn/editorial-status-badge";
import {
  ArrowRightIcon,
  BookOpenIcon,
  BoltIcon,
  ArrowPathIcon,
  LockClosedIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";

export const dynamic = "force-dynamic";

type UpdatePolicy = "frozen" | "live" | "periodic";
type ItemType =
  | "concept_card"
  | "microsector_brief"
  | "microsector_brief_block"
  | "briefing"
  | "deep_dive"
  | "podcast"
  | "quiz";

interface PathData {
  id: string;
  slug: string;
  title: string;
  goal: string | null;
  scope: Record<string, unknown> | null;
  update_policy: UpdatePolicy;
  editorial_status: EditorialStatus;
  updated_at: string;
  version: number;
}

interface ItemRow {
  id: string;
  position: number;
  chapter: string | null;
  item_type: ItemType;
  item_id: string;
  item_version: number | null;
  completion_required: boolean;
  note: string | null;
  resolved_title: string | null;
}

const READ_MINUTES: Record<ItemType, number> = {
  concept_card: 3,
  microsector_brief: 5,
  microsector_brief_block: 4,
  briefing: 5,
  deep_dive: 8,
  podcast: 6,
  quiz: 2,
};

const POLICY_META: Record<
  UpdatePolicy,
  { label: string; Icon: typeof BookOpenIcon }
> = {
  frozen: { label: "Pinned", Icon: LockClosedIcon },
  live: { label: "Live", Icon: BoltIcon },
  periodic: { label: "Periodic", Icon: ArrowPathIcon },
};

async function fetchPath(slug: string): Promise<PathData | null> {
  const { rows } = await pool.query<PathData>(
    `SELECT id, slug, title, goal, scope, update_policy,
            editorial_status::text AS editorial_status, updated_at, version
       FROM learning_paths
      WHERE slug = $1`,
    [slug],
  );
  return rows[0] ?? null;
}

async function fetchItems(pathId: string): Promise<ItemRow[]> {
  // Polymorphic title resolution via LEFT JOINs on the three body tables.
  const { rows } = await pool.query<ItemRow>(
    `SELECT
        lpi.id,
        lpi.position,
        lpi.chapter,
        lpi.item_type,
        lpi.item_id,
        lpi.item_version,
        lpi.completion_required,
        lpi.note,
        COALESCE(cc.term, mb.title, mbb.block_type, NULL) AS resolved_title
       FROM learning_path_items lpi
       LEFT JOIN concept_cards cc
         ON lpi.item_type = 'concept_card' AND cc.id::text = lpi.item_id
       LEFT JOIN microsector_briefs mb
         ON lpi.item_type = 'microsector_brief' AND mb.id::text = lpi.item_id
       LEFT JOIN microsector_brief_blocks mbb
         ON lpi.item_type = 'microsector_brief_block' AND mbb.id::text = lpi.item_id
      WHERE lpi.path_id = $1
      ORDER BY lpi.position ASC`,
    [pathId],
  );
  return rows;
}

async function fetchMicrosectorChips(scope: Record<string, unknown> | null) {
  if (!scope || !Array.isArray(scope.in_scope_microsectors)) return [];
  const ids = (scope.in_scope_microsectors as unknown[])
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v));
  if (ids.length === 0) return [];
  const { rows } = await pool.query<{ id: number; slug: string; name: string }>(
    `SELECT id, slug, name FROM taxonomy_microsectors WHERE id = ANY($1::int[])`,
    [ids],
  );
  return rows;
}

function estimateMinutes(items: ItemRow[]): number {
  return items.reduce((sum, it) => sum + (READ_MINUTES[it.item_type] ?? 3), 0);
}

function prettyItemType(t: ItemType): string {
  switch (t) {
    case "concept_card":
      return "Concept";
    case "microsector_brief":
      return "Brief";
    case "microsector_brief_block":
      return "Brief block";
    case "briefing":
      return "Briefing";
    case "deep_dive":
      return "Deep dive";
    case "podcast":
      return "Podcast";
    case "quiz":
      return "Quiz";
  }
}

export default async function LearnPathOverviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const path = await fetchPath(slug);
  if (!path) notFound();

  const [items, microsectors] = await Promise.all([
    fetchItems(path.id),
    fetchMicrosectorChips(path.scope),
  ]);

  const minutes = estimateMinutes(items);
  const policy = POLICY_META[path.update_policy];
  const { Icon: PolicyIcon } = policy;

  // Group items by chapter for TOC
  const chapters = new Map<string, ItemRow[]>();
  for (const it of items) {
    const key = it.chapter ?? "Reading order";
    if (!chapters.has(key)) chapters.set(key, []);
    chapters.get(key)!.push(it);
  }

  return (
    <div
      style={{
        maxWidth: 880,
        margin: "0 auto",
        padding: "32px 24px 64px",
        fontFamily: FONTS.sans,
        color: COLORS.ink,
      }}
    >
      <nav style={{ marginBottom: 16 }}>
        <Link
          href="/learn/paths"
          style={{
            all: "unset",
            cursor: "pointer",
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: COLORS.inkMuted,
          }}
        >
          ← All learning paths
        </Link>
      </nav>

      <header
        style={{
          borderBottom: `1px solid ${COLORS.border}`,
          paddingBottom: 20,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            marginBottom: 10,
          }}
        >
          <EditorialStatusBadge status={path.editorial_status} />
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "3px 8px",
              border: `1px solid ${COLORS.border}`,
              background: COLORS.surface,
              fontSize: 11,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: COLORS.inkSec,
              borderRadius: 2,
            }}
            title={`Update policy: ${path.update_policy}`}
          >
            <PolicyIcon width={12} height={12} strokeWidth={1.6} />
            {policy.label}
          </span>
        </div>
        <h1
          style={{
            fontFamily: FONTS.serif,
            fontSize: 36,
            lineHeight: 1.15,
            margin: "0 0 10px",
            fontWeight: 500,
          }}
        >
          {path.title}
        </h1>
        {path.goal && (
          <p
            style={{
              fontSize: 16,
              lineHeight: 1.55,
              color: COLORS.inkSec,
              margin: "0 0 14px",
              maxWidth: 680,
            }}
          >
            {path.goal}
          </p>
        )}

        <div
          style={{
            display: "flex",
            gap: 18,
            flexWrap: "wrap",
            color: COLORS.inkMuted,
            fontSize: 12,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            marginBottom: 14,
          }}
        >
          <span>
            {items.length} item{items.length === 1 ? "" : "s"}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <ClockIcon width={12} height={12} strokeWidth={1.6} />~{minutes} min
          </span>
          <span>v{path.version}</span>
        </div>

        {microsectors.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              marginBottom: 18,
            }}
          >
            {microsectors.map((m) => (
              <span
                key={m.id}
                style={{
                  display: "inline-block",
                  padding: "3px 8px",
                  background: COLORS.sageTint,
                  color: COLORS.forest,
                  fontSize: 11,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  border: `1px solid ${COLORS.sage}`,
                  borderRadius: 2,
                }}
                title={m.slug}
              >
                {m.name}
              </span>
            ))}
          </div>
        )}

        <Link
          href={`/learn/paths/${path.slug}/read`}
          style={{
            all: "unset",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 16px",
            background: COLORS.forest,
            color: "#fff",
            fontSize: 13,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            borderRadius: 2,
          }}
        >
          Start reading
          <ArrowRightIcon width={14} height={14} strokeWidth={1.6} />
        </Link>
      </header>

      <section>
        <h2
          style={{
            fontFamily: FONTS.serif,
            fontSize: 20,
            fontWeight: 500,
            margin: "0 0 12px",
          }}
        >
          Table of contents
        </h2>
        {items.length === 0 ? (
          <p style={{ color: COLORS.inkSec }}>No items in this path yet.</p>
        ) : (
          <ol
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              counterReset: "toc-item",
            }}
          >
            {Array.from(chapters.entries()).map(([chap, list]) => (
              <li key={chap} style={{ marginBottom: 20 }}>
                <div
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: COLORS.inkMuted,
                    marginBottom: 8,
                    paddingBottom: 4,
                    borderBottom: `1px solid ${COLORS.borderLight}`,
                  }}
                >
                  {chap}
                </div>
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {list.map((it) => (
                    <li
                      key={it.id}
                      style={{
                        padding: "10px 0",
                        borderBottom: `1px solid ${COLORS.borderLight}`,
                        display: "flex",
                        gap: 12,
                        alignItems: "baseline",
                      }}
                    >
                      <span
                        style={{
                          color: COLORS.inkMuted,
                          fontSize: 12,
                          minWidth: 28,
                          textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {String(it.position + 1).padStart(2, "0")}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontFamily: FONTS.serif,
                            fontSize: 15,
                            color: COLORS.ink,
                            lineHeight: 1.35,
                          }}
                        >
                          {it.resolved_title ?? "(missing content)"}
                        </div>
                        {it.note && (
                          <p
                            style={{
                              margin: "4px 0 0",
                              fontSize: 12,
                              color: COLORS.inkSec,
                              lineHeight: 1.5,
                            }}
                          >
                            {it.note}
                          </p>
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: 10,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: COLORS.inkMuted,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {prettyItemType(it.item_type)}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
