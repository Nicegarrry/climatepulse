import Link from "next/link";
import { notFound } from "next/navigation";
import pool from "@/lib/db";
import { getAuthUser } from "@/lib/supabase/server";
import { COLORS, FONTS } from "@/lib/design-tokens";
import {
  EditorialStatusBadge,
  type EditorialStatus,
} from "@/components/learn/editorial-status-badge";
import { ConceptTooltipScope } from "@/components/learn/inline-concept-tooltip";
import { MarkCompleteToggle } from "./MarkCompleteToggle";

export const dynamic = "force-dynamic";

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
  editorial_status: EditorialStatus;
}

interface RenderableItem {
  id: string;
  position: number;
  chapter: string | null;
  item_type: ItemType;
  item_id: string;
  note: string | null;
  title: string | null;
  editorial_status: EditorialStatus | null;
  body_text: string | null;
  body_json: unknown;
  completed: boolean;
}

async function fetchPath(slug: string): Promise<PathData | null> {
  const { rows } = await pool.query<PathData>(
    `SELECT id, slug, title, goal,
            editorial_status::text AS editorial_status
       FROM learning_paths
      WHERE slug = $1`,
    [slug],
  );
  return rows[0] ?? null;
}

async function fetchRenderableItems(
  pathId: string,
  userId: string | null,
): Promise<RenderableItem[]> {
  const { rows } = await pool.query<{
    id: string;
    position: number;
    chapter: string | null;
    item_type: ItemType;
    item_id: string;
    note: string | null;
    cc_term: string | null;
    cc_full_body: string | null;
    cc_editorial_status: string | null;
    mb_title: string | null;
    mb_tagline: string | null;
    mb_editorial_status: string | null;
    mb_lead_body: string | null;
    mbb_block_type: string | null;
    mbb_body: string | null;
    mbb_body_json: unknown;
    mbb_editorial_status: string | null;
    progress_completed: boolean | null;
  }>(
    `SELECT
        lpi.id,
        lpi.position,
        lpi.chapter,
        lpi.item_type,
        lpi.item_id,
        lpi.note,
        cc.term AS cc_term,
        cc.full_body AS cc_full_body,
        cc.editorial_status::text AS cc_editorial_status,
        mb.title AS mb_title,
        mb.tagline AS mb_tagline,
        mb.editorial_status::text AS mb_editorial_status,
        (SELECT b.body FROM microsector_brief_blocks b
           WHERE b.brief_id = mb.id AND b.body IS NOT NULL
           ORDER BY b.updated_at DESC LIMIT 1) AS mb_lead_body,
        mbb.block_type AS mbb_block_type,
        mbb.body AS mbb_body,
        mbb.body_json AS mbb_body_json,
        mbb.editorial_status::text AS mbb_editorial_status,
        (CASE WHEN $2::text IS NULL THEN NULL
              ELSE (lpp.id IS NOT NULL) END) AS progress_completed
       FROM learning_path_items lpi
       LEFT JOIN concept_cards cc
         ON lpi.item_type = 'concept_card' AND cc.id::text = lpi.item_id
       LEFT JOIN microsector_briefs mb
         ON lpi.item_type = 'microsector_brief' AND mb.id::text = lpi.item_id
       LEFT JOIN microsector_brief_blocks mbb
         ON lpi.item_type = 'microsector_brief_block' AND mbb.id::text = lpi.item_id
       LEFT JOIN learning_path_progress lpp
         ON lpp.user_id = $2 AND lpp.item_id = lpi.id
      WHERE lpi.path_id = $1
      ORDER BY lpi.position ASC`,
    [pathId, userId],
  );

  return rows.map<RenderableItem>((r) => {
    let title: string | null = null;
    let editorial_status: EditorialStatus | null = null;
    let body_text: string | null = null;
    let body_json: unknown = null;

    if (r.item_type === "concept_card") {
      title = r.cc_term ?? null;
      editorial_status = (r.cc_editorial_status as EditorialStatus) ?? null;
      body_text = r.cc_full_body ?? null;
    } else if (r.item_type === "microsector_brief") {
      title = r.mb_title ?? null;
      editorial_status = (r.mb_editorial_status as EditorialStatus) ?? null;
      body_text = [r.mb_tagline, r.mb_lead_body].filter(Boolean).join("\n\n");
      if (!body_text) body_text = null;
    } else if (r.item_type === "microsector_brief_block") {
      title = r.mbb_block_type ?? null;
      editorial_status = (r.mbb_editorial_status as EditorialStatus) ?? null;
      body_text = r.mbb_body ?? null;
      body_json = r.mbb_body_json ?? null;
    }

    return {
      id: r.id,
      position: r.position,
      chapter: r.chapter,
      item_type: r.item_type,
      item_id: r.item_id,
      note: r.note,
      title,
      editorial_status,
      body_text,
      body_json,
      completed: Boolean(r.progress_completed),
    };
  });
}

function formatBlockTypeLabel(t: string): string {
  return t
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default async function LearnPathReadPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [path, user] = await Promise.all([fetchPath(slug), getAuthUser()]);
  if (!path) notFound();

  const items = await fetchRenderableItems(path.id, user?.id ?? null);

  // Group by chapter, preserving insertion order.
  const chapters: { chapter: string; items: RenderableItem[] }[] = [];
  const chapterIndex = new Map<string, number>();
  for (const it of items) {
    const key = it.chapter ?? "Reading order";
    if (!chapterIndex.has(key)) {
      chapterIndex.set(key, chapters.length);
      chapters.push({ chapter: key, items: [] });
    }
    chapters[chapterIndex.get(key)!].items.push(it);
  }

  return (
    <ConceptTooltipScope>
      <div
        style={{
          maxWidth: 760,
          margin: "0 auto",
          padding: "32px 24px 96px",
          fontFamily: FONTS.sans,
          color: COLORS.ink,
        }}
      >
        <nav style={{ marginBottom: 16 }}>
          <Link
            href={`/learn/paths/${path.slug}`}
            style={{
              all: "unset",
              cursor: "pointer",
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: COLORS.inkMuted,
            }}
          >
            ← Path overview
          </Link>
        </nav>

        <header
          style={{
            borderBottom: `1px solid ${COLORS.border}`,
            paddingBottom: 20,
            marginBottom: 32,
          }}
        >
          <EditorialStatusBadge status={path.editorial_status} />
          <h1
            style={{
              fontFamily: FONTS.serif,
              fontSize: 32,
              lineHeight: 1.15,
              margin: "12px 0 6px",
              fontWeight: 500,
            }}
          >
            {path.title}
          </h1>
          {path.goal && (
            <p
              style={{
                fontSize: 15,
                lineHeight: 1.55,
                color: COLORS.inkSec,
                margin: 0,
              }}
            >
              {path.goal}
            </p>
          )}
        </header>

        {!user && (
          <div
            style={{
              padding: "12px 14px",
              border: `1px dashed ${COLORS.border}`,
              background: COLORS.paperDark,
              color: COLORS.inkSec,
              fontSize: 13,
              marginBottom: 24,
            }}
          >
            Sign in to track completion as you read.
          </div>
        )}

        {chapters.length === 0 && (
          <p style={{ color: COLORS.inkSec }}>This path has no readable items.</p>
        )}

        {chapters.map((ch) => (
          <section key={ch.chapter} style={{ marginBottom: 40 }}>
            <h2
              style={{
                fontSize: 11,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: COLORS.inkMuted,
                margin: "0 0 12px",
                paddingBottom: 6,
                borderBottom: `1px solid ${COLORS.borderLight}`,
                fontWeight: 500,
              }}
            >
              {ch.chapter}
            </h2>

            {ch.items.map((it) => (
              <article
                key={it.id}
                id={`item-${it.id}`}
                style={{
                  marginBottom: 28,
                  paddingBottom: 24,
                  borderBottom: `1px solid ${COLORS.borderLight}`,
                }}
              >
                <header
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 12,
                    marginBottom: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: 10,
                        marginBottom: 4,
                      }}
                    >
                      <span
                        style={{
                          fontVariantNumeric: "tabular-nums",
                          fontSize: 11,
                          color: COLORS.inkMuted,
                          letterSpacing: "0.04em",
                        }}
                      >
                        {String(it.position + 1).padStart(2, "0")}
                      </span>
                      <h3
                        style={{
                          fontFamily: FONTS.serif,
                          fontSize: 22,
                          lineHeight: 1.2,
                          margin: 0,
                          fontWeight: 500,
                        }}
                      >
                        {it.item_type === "microsector_brief_block" && it.title
                          ? formatBlockTypeLabel(it.title)
                          : (it.title ?? "(Missing content)")}
                      </h3>
                    </div>
                    {it.editorial_status && (
                      <EditorialStatusBadge
                        status={it.editorial_status}
                        compact
                      />
                    )}
                  </div>
                  {user && (
                    <MarkCompleteToggle
                      slug={path.slug}
                      itemId={it.id}
                      initialCompleted={it.completed}
                    />
                  )}
                </header>

                {it.note && (
                  <p
                    style={{
                      borderLeft: `2px solid ${COLORS.sage}`,
                      padding: "2px 10px",
                      margin: "0 0 14px",
                      color: COLORS.inkSec,
                      fontSize: 13,
                      lineHeight: 1.5,
                      fontStyle: "italic",
                    }}
                  >
                    {it.note}
                  </p>
                )}

                <ItemBody item={it} />
              </article>
            ))}
          </section>
        ))}
      </div>
    </ConceptTooltipScope>
  );
}

function ItemBody({ item }: { item: RenderableItem }) {
  if (item.body_text) {
    return (
      <div
        style={{
          fontFamily: FONTS.serif,
          fontSize: 17,
          lineHeight: 1.65,
          color: COLORS.ink,
          whiteSpace: "pre-wrap",
        }}
      >
        {item.body_text}
      </div>
    );
  }
  if (item.body_json) {
    return (
      <pre
        style={{
          background: COLORS.paperDark,
          padding: 12,
          borderRadius: 2,
          fontSize: 12,
          overflowX: "auto",
          color: COLORS.inkSec,
        }}
      >
        {JSON.stringify(item.body_json, null, 2)}
      </pre>
    );
  }
  return (
    <p
      style={{
        color: COLORS.inkMuted,
        fontSize: 13,
        margin: 0,
        fontStyle: "italic",
      }}
    >
      Content not yet available for this item.
    </p>
  );
}
