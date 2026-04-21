/**
 * CourseView — course-template surface renderer.
 *
 * Course template = ordered chapters (surface.layout.chapters). Each chapter
 * either:
 *   - references a learning_path by slug (we resolve items inline), or
 *   - lists item_ids directly.
 *
 * If the viewer is authed, we overlay learning_path_progress to show a
 * completion percentage per chapter.
 *
 * Custom modules + quizzes render after chapters.
 * The quiz is a lightweight client component with no API call yet.
 */
import Link from "next/link";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import pool from "@/lib/db";
import { COLORS, FONTS } from "@/lib/design-tokens";
import type {
  AccessDecision,
  KnowledgeSurface,
  SurfaceLayout,
} from "@/lib/surfaces/types";
import { QuizRunner } from "./QuizRunner";

interface CourseViewProps {
  surface: KnowledgeSurface;
  decision: AccessDecision;
  viewerUserId: string | null;
}

interface ResolvedChapter {
  label: string;
  note: string | null;
  items: ResolvedItem[];
  path_slug?: string;
  path_id?: string | null;
  completion_pct: number | null;
}

interface ResolvedItem {
  id: string;
  item_type: string;
  item_id: string;
  note: string | null;
  title: string;
  completed: boolean;
}

export async function CourseView({
  surface,
  decision: _decision,
  viewerUserId,
}: CourseViewProps) {
  const chapters = surface.layout.chapters ?? [];
  const resolved = await resolveChapters(chapters, viewerUserId);

  return (
    <div
      style={{
        maxWidth: 880,
        margin: "0 auto",
        padding: "56px 28px 96px",
      }}
    >
      <CourseHeader surface={surface} />

      <IntroSection surface={surface} />

      {resolved.length === 0 ? (
        <section
          style={{
            padding: "32px 0",
            color: COLORS.inkMuted,
            borderTop: `1px solid ${COLORS.border}`,
            borderBottom: `1px solid ${COLORS.border}`,
            fontSize: 14,
          }}
        >
          This course has no chapters yet.
        </section>
      ) : (
        <section style={{ marginBottom: 48 }}>
          {resolved.map((ch, i) => (
            <ChapterBlock key={`${ch.label}-${i}`} index={i} chapter={ch} />
          ))}
        </section>
      )}

      <CustomModulesSection surface={surface} />

      <QuizzesSection surface={surface} />
    </div>
  );
}

// ─── Header + intro ───────────────────────────────────────────────────────────

function CourseHeader({ surface }: { surface: KnowledgeSurface }) {
  return (
    <header
      style={{
        borderBottom: `1px solid ${COLORS.border}`,
        paddingBottom: 20,
        marginBottom: 32,
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: COLORS.inkMuted,
          marginBottom: 10,
        }}
      >
        Course
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
    </header>
  );
}

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
              margin: "0 0 16px",
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

// ─── Chapter resolution ───────────────────────────────────────────────────────

async function resolveChapters(
  chapters: NonNullable<SurfaceLayout["chapters"]>,
  viewerUserId: string | null,
): Promise<ResolvedChapter[]> {
  const out: ResolvedChapter[] = [];
  for (const ch of chapters) {
    if (ch.path_slug) {
      const resolved = await resolveChapterFromPath(
        ch.label,
        ch.note ?? null,
        ch.path_slug,
        viewerUserId,
      );
      out.push(resolved);
    } else if (ch.item_ids && ch.item_ids.length > 0) {
      const items = await resolveItemsById(ch.item_ids);
      out.push({
        label: ch.label,
        note: ch.note ?? null,
        items,
        completion_pct: null,
      });
    } else {
      out.push({
        label: ch.label,
        note: ch.note ?? null,
        items: [],
        completion_pct: null,
      });
    }
  }
  return out;
}

async function resolveChapterFromPath(
  label: string,
  note: string | null,
  pathSlug: string,
  viewerUserId: string | null,
): Promise<ResolvedChapter> {
  try {
    const { rows: pathRows } = await pool.query<{ id: string }>(
      `SELECT id FROM learning_paths WHERE slug = $1`,
      [pathSlug],
    );
    const path_id = pathRows[0]?.id ?? null;
    if (!path_id) {
      return { label, note, items: [], path_slug: pathSlug, path_id: null, completion_pct: null };
    }

    const { rows: items } = await pool.query<{
      id: string;
      item_type: string;
      item_id: string;
      note: string | null;
      cc_term: string | null;
      mb_title: string | null;
      mbb_block_type: string | null;
      mbb_brief_title: string | null;
      completed: boolean;
    }>(
      `SELECT
          lpi.id, lpi.item_type, lpi.item_id, lpi.note,
          cc.term AS cc_term,
          mb.title AS mb_title,
          mbb.block_type AS mbb_block_type,
          (SELECT title FROM microsector_briefs WHERE id = mbb.brief_id) AS mbb_brief_title,
          CASE WHEN $2::text IS NOT NULL AND lpp.id IS NOT NULL THEN TRUE ELSE FALSE END AS completed
        FROM learning_path_items lpi
        LEFT JOIN concept_cards cc
          ON lpi.item_type = 'concept_card' AND cc.id::text = lpi.item_id
        LEFT JOIN microsector_briefs mb
          ON lpi.item_type = 'microsector_brief' AND mb.id::text = lpi.item_id
        LEFT JOIN microsector_brief_blocks mbb
          ON lpi.item_type = 'microsector_brief_block' AND mbb.id::text = lpi.item_id
        LEFT JOIN learning_path_progress lpp
          ON lpp.item_id = lpi.id AND lpp.user_id = $2
        WHERE lpi.path_id = $1
        ORDER BY lpi.position`,
      [path_id, viewerUserId],
    );

    const resolved: ResolvedItem[] = items.map((r) => ({
      id: r.id,
      item_type: r.item_type,
      item_id: r.item_id,
      note: r.note,
      title: titleFor(r),
      completed: !!r.completed,
    }));

    const completion_pct =
      viewerUserId && resolved.length > 0
        ? Math.round(
            (resolved.filter((r) => r.completed).length / resolved.length) * 100,
          )
        : null;

    return {
      label,
      note,
      items: resolved,
      path_slug: pathSlug,
      path_id,
      completion_pct,
    };
  } catch (err) {
    console.error("[s/slug/CourseView] resolveChapterFromPath failed:", err);
    return { label, note, items: [], path_slug: pathSlug, path_id: null, completion_pct: null };
  }
}

function titleFor(r: {
  item_type: string;
  item_id: string;
  cc_term: string | null;
  mb_title: string | null;
  mbb_block_type: string | null;
  mbb_brief_title: string | null;
}): string {
  if (r.item_type === "concept_card" && r.cc_term) return r.cc_term;
  if (r.item_type === "microsector_brief" && r.mb_title) return r.mb_title;
  if (r.item_type === "microsector_brief_block" && r.mbb_brief_title) {
    return `${r.mbb_brief_title} — ${(r.mbb_block_type ?? "block").replace(/_/g, " ")}`;
  }
  return `[${r.item_type}] ${r.item_id.slice(0, 8)}`;
}

async function resolveItemsById(itemIds: string[]): Promise<ResolvedItem[]> {
  // item_ids here are string pairs like `concept_card:uuid` — or raw UUIDs we
  // can't classify. Best-effort: try to parse `type:id` style; otherwise emit
  // a generic row.
  const out: ResolvedItem[] = [];
  for (const raw of itemIds) {
    const [maybeType, maybeId] = raw.includes(":") ? raw.split(":", 2) : ["", raw];
    const item_type = maybeType || "unknown";
    const item_id = maybeId;
    let title = `[${item_type}] ${item_id.slice(0, 8)}`;
    try {
      if (item_type === "concept_card") {
        const { rows } = await pool.query<{ term: string }>(
          `SELECT term FROM concept_cards WHERE id::text = $1`,
          [item_id],
        );
        if (rows[0]) title = rows[0].term;
      } else if (item_type === "microsector_brief") {
        const { rows } = await pool.query<{ title: string }>(
          `SELECT title FROM microsector_briefs WHERE id::text = $1`,
          [item_id],
        );
        if (rows[0]) title = rows[0].title;
      }
    } catch {
      // swallow
    }
    out.push({
      id: raw,
      item_type,
      item_id,
      note: null,
      title,
      completed: false,
    });
  }
  return out;
}

// ─── Chapter renderer ─────────────────────────────────────────────────────────

function ChapterBlock({ index, chapter }: { index: number; chapter: ResolvedChapter }) {
  return (
    <article
      style={{
        padding: "28px 0",
        borderTop: `1px solid ${COLORS.border}`,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span
            style={{
              fontFamily: FONTS.sans,
              fontSize: 11,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: COLORS.inkMuted,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            Chapter {String(index + 1).padStart(2, "0")}
          </span>
          <h2
            style={{
              fontFamily: FONTS.serif,
              fontSize: 26,
              margin: 0,
              fontWeight: 500,
              color: COLORS.ink,
              letterSpacing: "-0.2px",
            }}
          >
            {chapter.label}
          </h2>
        </div>
        {chapter.completion_pct !== null && (
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color:
                chapter.completion_pct === 100
                  ? "var(--surface-primary, " + COLORS.forest + ")"
                  : COLORS.inkSec,
            }}
          >
            {chapter.completion_pct}% complete
          </div>
        )}
      </header>

      {chapter.note && (
        <p
          style={{
            fontFamily: FONTS.serif,
            fontSize: 15,
            color: COLORS.inkSec,
            lineHeight: 1.55,
            margin: "0 0 16px",
            fontStyle: "italic",
          }}
        >
          {chapter.note}
        </p>
      )}

      {chapter.items.length === 0 ? (
        <div style={{ color: COLORS.inkMuted, fontSize: 13, padding: "8px 0" }}>
          {chapter.path_slug
            ? `No items found in path ${chapter.path_slug}.`
            : "No items in this chapter."}
        </div>
      ) : (
        <ol
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            counterReset: "item",
          }}
        >
          {chapter.items.map((item, i) => (
            <li
              key={item.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 0",
                borderBottom: `1px solid ${COLORS.borderLight}`,
              }}
            >
              <span
                style={{
                  fontFamily: FONTS.sans,
                  fontSize: 11,
                  color: COLORS.inkMuted,
                  fontVariantNumeric: "tabular-nums",
                  minWidth: 24,
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              {item.completed && (
                <CheckCircleIcon
                  width={16}
                  height={16}
                  strokeWidth={1.6}
                  aria-label="Completed"
                  style={{
                    color: "var(--surface-primary, " + COLORS.forest + ")",
                    flex: "none",
                  }}
                />
              )}
              <ItemLink item={item} />
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}

function ItemLink({ item }: { item: ResolvedItem }) {
  const href = hrefForItem(item);
  const inner = (
    <span
      style={{
        fontFamily: FONTS.serif,
        fontSize: 16,
        color: COLORS.ink,
        lineHeight: 1.35,
      }}
    >
      {item.title}
    </span>
  );
  if (!href) return inner;
  return (
    <Link href={href} style={{ textDecoration: "none", flex: 1, minWidth: 0 }}>
      {inner}
    </Link>
  );
}

function hrefForItem(item: ResolvedItem): string | null {
  if (item.item_type === "concept_card") return `/learn/concepts/${item.item_id}`;
  if (item.item_type === "microsector_brief") {
    return `/learn/microsectors/${item.item_id}`;
  }
  return null;
}

// ─── Custom modules & quizzes ─────────────────────────────────────────────────

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

function QuizzesSection({ surface }: { surface: KnowledgeSurface }) {
  const quizzes = surface.overlay.custom_quizzes;
  if (!quizzes || quizzes.length === 0) return null;
  return (
    <section style={{ marginTop: 16 }}>
      <div
        style={{
          fontSize: 11,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: COLORS.inkMuted,
          borderBottom: `1px solid ${COLORS.border}`,
          paddingBottom: 8,
          marginBottom: 16,
        }}
      >
        Check your understanding
      </div>
      {quizzes.map((q) => (
        <QuizRunner key={q.id} quiz={q} />
      ))}
    </section>
  );
}
