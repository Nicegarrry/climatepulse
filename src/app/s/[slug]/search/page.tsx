/**
 * Scoped surface search: /s/[slug]/search?q=...
 *
 * Enforces the same access checks as the surface root, then runs
 * retrieveContent through buildScopedFilters so results are bounded by the
 * surface's scope (microsectors, entities, domains, time window).
 *
 * Rendering mirrors the global /learn/search page but uses surface branding.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { COLORS, FONTS } from "@/lib/design-tokens";
import { getAuthUser } from "@/lib/supabase/server";
import {
  fetchSurfaceBySlug,
  resolveAccess,
  type Viewer,
} from "@/lib/surfaces/access";
import {
  buildScopedFilters,
  defaultContentTypes,
} from "@/lib/surfaces/scope-filter";
import { retrieveContent, type RetrievedContent } from "@/lib/intelligence/retriever";
import type { ContentType } from "@/lib/intelligence/embedder";
import {
  EditorialStatusBadge,
  type EditorialStatus,
} from "@/components/learn/editorial-status-badge";

export const dynamic = "force-dynamic";

const GROUP_ORDER = [
  "concept_card",
  "microsector_brief",
  "microsector_brief_block",
  "learning_path",
  "deep_dive",
  "article",
  "daily_digest",
  "podcast",
  "weekly_digest",
  "uploaded_doc",
  "surface_module",
] as const;

const GROUP_LABELS: Record<string, string> = {
  concept_card: "Concept cards",
  microsector_brief: "Microsector briefs",
  microsector_brief_block: "Brief blocks",
  learning_path: "Learning paths",
  deep_dive: "Deep dives",
  article: "Articles",
  daily_digest: "Daily briefings",
  podcast: "Podcasts",
  weekly_digest: "Weekly digests",
  uploaded_doc: "Uploaded docs",
  surface_module: "Surface modules",
};

function hrefFor(item: RetrievedContent): string {
  if (item.content_type === "concept_card" && item.slug) {
    return `/learn/concepts/${item.slug}`;
  }
  if (item.content_type === "microsector_brief" && item.slug) {
    return `/learn/microsectors/${item.slug}`;
  }
  if (item.content_type === "microsector_brief_block" && item.slug) {
    return `/learn/microsectors/${item.slug}#${item.source_id}`;
  }
  if (item.content_type === "learning_path" && item.slug) {
    return `/learn/paths/${item.slug}`;
  }
  if (item.content_type === "article" && item.url) return item.url;
  return "#";
}

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
}

export default async function SurfaceSearchPage(props: PageProps) {
  const { slug } = await props.params;
  const { q = "" } = await props.searchParams;
  const query = q.trim();

  const surface = await fetchSurfaceBySlug(slug);
  const user = await getAuthUser();
  const viewer: Viewer = { user_id: user?.id ?? null, email: user?.email ?? null };
  const decision = await resolveAccess(surface, viewer);

  if (!decision.allowed) {
    if (decision.reason === "surface_not_found" || decision.reason === "archived") {
      notFound();
    }
    if (decision.reason === "needs_sign_in") {
      redirect(`/login?next=${encodeURIComponent(`/s/${slug}/search`)}`);
    }
    // Any other denial: bounce to the surface root, which knows how to render
    // cohort prompts / access explanations.
    redirect(`/s/${slug}`);
  }

  const s = surface!;
  const primary = s.branding.primary_colour ?? COLORS.forest;

  let results: RetrievedContent[] = [];
  if (query.length > 0) {
    try {
      const scoped = await buildScopedFilters(s);
      const contentTypes = defaultContentTypes(s) as ContentType[];
      results = await retrieveContent(
        query,
        { ...scoped, content_types: contentTypes },
        { limit: 40, dedupeBySource: true },
      );
    } catch (err) {
      console.error("[s/slug/search] retrieveContent failed:", err);
      results = [];
    }
  }

  const grouped = new Map<string, RetrievedContent[]>();
  for (const r of results) {
    if (!grouped.has(r.content_type)) grouped.set(r.content_type, []);
    grouped.get(r.content_type)!.push(r);
  }

  return (
    <div
      style={
        {
          minHeight: "100vh",
          background: COLORS.bg,
          color: COLORS.ink,
          fontFamily: FONTS.sans,
          ["--surface-primary" as string]: primary,
        } as React.CSSProperties
      }
    >
      <div
        style={{
          maxWidth: 820,
          margin: "0 auto",
          padding: "48px 24px 72px",
        }}
      >
        <div style={{ marginBottom: 24 }}>
          <Link
            href={`/s/${s.slug}`}
            style={{
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: COLORS.inkMuted,
              textDecoration: "none",
            }}
          >
            ← {s.title}
          </Link>
          <h1
            style={{
              fontFamily: FONTS.serif,
              fontSize: 36,
              fontWeight: 500,
              lineHeight: 1.1,
              letterSpacing: "-0.4px",
              margin: "10px 0 0",
              color: "var(--surface-primary, " + COLORS.forest + ")",
            }}
          >
            Search within this surface
          </h1>
          <p
            style={{
              marginTop: 10,
              fontSize: 13,
              color: COLORS.inkSec,
              lineHeight: 1.5,
            }}
          >
            Results are restricted to this surface&rsquo;s scope.
          </p>
        </div>

        <form
          method="get"
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            marginBottom: 32,
            borderBottom: `1px solid ${COLORS.border}`,
            paddingBottom: 12,
          }}
        >
          <input
            type="search"
            name="q"
            defaultValue={query}
            autoFocus
            placeholder={`Search ${s.title.toLowerCase()}…`}
            style={{
              flex: 1,
              fontFamily: FONTS.serif,
              fontSize: 20,
              lineHeight: 1.3,
              border: "none",
              outline: "none",
              background: "transparent",
              color: COLORS.ink,
              padding: "8px 0",
            }}
          />
          <button
            type="submit"
            style={{
              fontFamily: FONTS.sans,
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              padding: "8px 14px",
              border: `1px solid var(--surface-primary, ${COLORS.forest})`,
              background: "var(--surface-primary, " + COLORS.forest + ")",
              color: COLORS.surface,
              cursor: "pointer",
            }}
          >
            Search
          </button>
        </form>

        {query.length === 0 && (
          <div style={{ color: COLORS.inkMuted, fontSize: 14 }}>
            Enter a query to search within {s.title}.
          </div>
        )}

        {query.length > 0 && results.length === 0 && (
          <div style={{ color: COLORS.inkSec, fontSize: 14, lineHeight: 1.5 }}>
            No matches for <strong>{query}</strong> inside this surface.
          </div>
        )}

        {GROUP_ORDER.map((contentType) => {
          const bucket = grouped.get(contentType);
          if (!bucket || bucket.length === 0) return null;
          return (
            <section key={contentType} style={{ marginBottom: 36 }}>
              <h2
                style={{
                  fontFamily: FONTS.sans,
                  fontSize: 11,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: COLORS.inkMuted,
                  borderBottom: `1px solid ${COLORS.border}`,
                  paddingBottom: 6,
                  marginBottom: 12,
                }}
              >
                {GROUP_LABELS[contentType] ?? contentType} · {bucket.length}
              </h2>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {bucket.map((item) => (
                  <li
                    key={`${item.content_type}:${item.source_id}:${item.chunk_index}`}
                    style={{
                      padding: "14px 0",
                      borderBottom: `1px solid ${COLORS.borderLight}`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                      <Link
                        href={hrefFor(item)}
                        style={{
                          fontFamily: FONTS.serif,
                          fontSize: 18,
                          color: COLORS.ink,
                          textDecoration: "none",
                          fontWeight: 500,
                          lineHeight: 1.2,
                        }}
                      >
                        {item.title}
                      </Link>
                      {item.editorial_status && (
                        <EditorialStatusBadge
                          status={item.editorial_status as EditorialStatus}
                          compact
                        />
                      )}
                    </div>
                    {(item.snippet || item.chunk_text) && (
                      <p
                        style={{
                          fontSize: 13,
                          color: COLORS.inkSec,
                          lineHeight: 1.5,
                          margin: "6px 0 0",
                        }}
                      >
                        {(item.snippet ?? item.chunk_text)?.slice(0, 240)}
                        {(item.snippet ?? item.chunk_text ?? "").length > 240 && "…"}
                      </p>
                    )}
                    {item.subtitle && (
                      <div
                        style={{
                          fontSize: 11,
                          color: COLORS.inkMuted,
                          marginTop: 6,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {item.subtitle} · score {item.combined_score.toFixed(2)}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
