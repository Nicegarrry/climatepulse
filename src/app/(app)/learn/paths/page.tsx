import Link from "next/link";
import pool from "@/lib/db";
import { COLORS, FONTS } from "@/lib/design-tokens";
import {
  EditorialStatusBadge,
  type EditorialStatus,
} from "@/components/learn/editorial-status-badge";
import {
  BookOpenIcon,
  BoltIcon,
  ArrowPathIcon,
  LockClosedIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";

export const dynamic = "force-dynamic";

type UpdatePolicy = "frozen" | "live" | "periodic";

interface PathRow {
  id: string;
  slug: string;
  title: string;
  goal: string | null;
  scope: Record<string, unknown> | null;
  update_policy: UpdatePolicy;
  editorial_status: EditorialStatus;
  item_count: number;
  updated_at: string;
}

function truncate(text: string | null, max = 140): string {
  if (!text) return "";
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}

const POLICY_META: Record<
  UpdatePolicy,
  { label: string; description: string; Icon: typeof BookOpenIcon }
> = {
  frozen: {
    label: "Pinned paths",
    description:
      "Content pinned to the version you started with. Stable reading experiences.",
    Icon: LockClosedIcon,
  },
  live: {
    label: "Live paths",
    description:
      "Items follow the current canonical version — updates as the field moves.",
    Icon: BoltIcon,
  },
  periodic: {
    label: "Periodic paths",
    description: "Refreshed on a cadence — e.g. weekly roundups and monthly primers.",
    Icon: ArrowPathIcon,
  },
};

async function fetchPaths(): Promise<PathRow[]> {
  const { rows } = await pool.query<PathRow>(
    `SELECT
        lp.id,
        lp.slug,
        lp.title,
        lp.goal,
        lp.scope,
        lp.update_policy,
        lp.editorial_status::text AS editorial_status,
        lp.updated_at,
        COALESCE(cnt.item_count, 0)::int AS item_count
      FROM learning_paths lp
      LEFT JOIN (
        SELECT path_id, COUNT(*)::int AS item_count
          FROM learning_path_items
         GROUP BY path_id
      ) cnt ON cnt.path_id = lp.id
      WHERE lp.editorial_status IN ('editor_authored','editor_reviewed','user_generated')
      ORDER BY lp.updated_at DESC
      LIMIT 200`,
  );
  return rows;
}

export default async function LearnPathsIndexPage() {
  const paths = await fetchPaths();

  const grouped: Record<UpdatePolicy, PathRow[]> = {
    frozen: [],
    live: [],
    periodic: [],
  };
  for (const p of paths) {
    (grouped[p.update_policy] ?? (grouped.frozen)).push(p);
  }

  const order: UpdatePolicy[] = ["live", "periodic", "frozen"];

  return (
    <div
      style={{
        maxWidth: 1040,
        margin: "0 auto",
        padding: "32px 24px 64px",
        fontFamily: FONTS.sans,
        color: COLORS.ink,
      }}
    >
      <header
        style={{
          borderBottom: `1px solid ${COLORS.border}`,
          paddingBottom: 20,
          marginBottom: 28,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <p
            style={{
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: COLORS.inkMuted,
              margin: 0,
            }}
          >
            Learn
          </p>
          <h1
            style={{
              fontFamily: FONTS.serif,
              fontSize: 36,
              lineHeight: 1.1,
              margin: "4px 0 8px",
              fontWeight: 500,
            }}
          >
            Learning paths
          </h1>
          <p
            style={{
              maxWidth: 640,
              margin: 0,
              color: COLORS.inkSec,
              fontSize: 15,
              lineHeight: 1.5,
            }}
          >
            Sequenced reading threads. Start from a curated editor path, or
            generate one from a question of your own.
          </p>
        </div>
        <Link
          href="/learn/paths/generate"
          style={{
            all: "unset",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 14px",
            background: COLORS.forest,
            color: "#fff",
            fontSize: 13,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            borderRadius: 2,
          }}
        >
          <SparklesIcon width={16} height={16} strokeWidth={1.6} />
          Generate a path
        </Link>
      </header>

      {paths.length === 0 && (
        <div
          style={{
            padding: "40px 24px",
            border: `1px dashed ${COLORS.border}`,
            background: COLORS.surface,
            textAlign: "center",
            color: COLORS.inkSec,
          }}
        >
          No learning paths published yet.
        </div>
      )}

      {order.map((policy) => {
        const list = grouped[policy];
        if (!list || list.length === 0) return null;
        const meta = POLICY_META[policy];
        const { Icon } = meta;
        return (
          <section key={policy} style={{ marginBottom: 40 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 4,
              }}
            >
              <Icon
                width={16}
                height={16}
                strokeWidth={1.6}
                aria-hidden="true"
                style={{ color: COLORS.forestMid }}
              />
              <h2
                style={{
                  fontFamily: FONTS.serif,
                  fontSize: 20,
                  fontWeight: 500,
                  margin: 0,
                }}
              >
                {meta.label}
              </h2>
              <span
                style={{
                  color: COLORS.inkMuted,
                  fontSize: 12,
                  letterSpacing: "0.04em",
                }}
              >
                ({list.length})
              </span>
            </div>
            <p
              style={{
                color: COLORS.inkSec,
                fontSize: 13,
                margin: "0 0 14px 26px",
              }}
            >
              {meta.description}
            </p>

            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                gap: 12,
              }}
            >
              {list.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/learn/paths/${p.slug}`}
                    style={{
                      all: "unset",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      height: "100%",
                      padding: "14px 16px",
                      border: `1px solid ${COLORS.border}`,
                      background: COLORS.surface,
                      borderRadius: 2,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <h3
                        style={{
                          fontFamily: FONTS.serif,
                          fontSize: 17,
                          lineHeight: 1.25,
                          margin: 0,
                          fontWeight: 500,
                          color: COLORS.ink,
                        }}
                      >
                        {p.title}
                      </h3>
                      <EditorialStatusBadge
                        status={p.editorial_status}
                        compact
                      />
                    </div>
                    {p.goal && (
                      <p
                        style={{
                          color: COLORS.inkSec,
                          fontSize: 13,
                          lineHeight: 1.5,
                          margin: 0,
                        }}
                      >
                        {truncate(p.goal, 140)}
                      </p>
                    )}
                    <ScopeSummary scope={p.scope} />
                    <div
                      style={{
                        marginTop: "auto",
                        display: "flex",
                        justifyContent: "space-between",
                        color: COLORS.inkMuted,
                        fontSize: 11,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                      }}
                    >
                      <span>
                        {p.item_count} item{p.item_count === 1 ? "" : "s"}
                      </span>
                      <span>
                        <BookOpenIcon
                          width={12}
                          height={12}
                          strokeWidth={1.6}
                          style={{
                            display: "inline-block",
                            verticalAlign: "-1px",
                            marginRight: 4,
                          }}
                        />
                        Read path
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function ScopeSummary({ scope }: { scope: Record<string, unknown> | null }) {
  if (!scope) return null;
  const ms = Array.isArray(scope.in_scope_microsectors)
    ? (scope.in_scope_microsectors as unknown[])
    : [];
  const level =
    typeof scope.learning_level === "string" ? scope.learning_level : null;
  const horizon =
    typeof scope.time_budget === "string"
      ? scope.time_budget
      : typeof scope.time_horizon === "string"
        ? (scope.time_horizon as string)
        : null;
  if (ms.length === 0 && !level && !horizon) return null;
  return (
    <div
      style={{
        fontSize: 11,
        color: COLORS.inkMuted,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
      }}
    >
      {ms.length > 0 && <span>{ms.length} microsector{ms.length === 1 ? "" : "s"}</span>}
      {level && <span>{level}</span>}
      {horizon && <span>{horizon}</span>}
    </div>
  );
}
