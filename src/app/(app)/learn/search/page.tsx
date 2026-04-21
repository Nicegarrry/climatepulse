import Link from "next/link";
import { COLORS, FONTS } from "@/lib/design-tokens";
import { retrieveForLearn } from "@/lib/learn/retriever-extensions";
import { EditorialStatusBadge, type EditorialStatus } from "@/components/learn/editorial-status-badge";
import type { RetrievedContent } from "@/lib/intelligence/retriever";

export const dynamic = "force-dynamic";

interface SearchParams {
  q?: string;
}

const GROUP_ORDER = [
  "concept_card",
  "microsector_brief",
  "microsector_brief_block",
  "learning_path",
  "deep_dive",
] as const;

const GROUP_LABELS: Record<string, string> = {
  concept_card: "Concept cards",
  microsector_brief: "Microsector briefs",
  microsector_brief_block: "Brief blocks",
  learning_path: "Learning paths",
  deep_dive: "Deep dives",
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
  return "#";
}

export default async function LearnSearchPage(props: {
  searchParams: Promise<SearchParams>;
}) {
  const { q = "" } = await props.searchParams;
  const query = q.trim();

  let results: RetrievedContent[] = [];
  if (query.length > 0) {
    try {
      results = await retrieveForLearn(query, {}, { limit: 40 });
    } catch (err) {
      console.error("[learn/search] retrieveForLearn failed:", err);
      results = [];
    }
  }

  const grouped = new Map<string, RetrievedContent[]>();
  for (const r of results) {
    const key = r.content_type;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(r);
  }

  return (
    <div
      style={{
        maxWidth: 820,
        margin: "0 auto",
        padding: "48px 24px 72px",
        fontFamily: FONTS.sans,
        color: COLORS.ink,
      }}
    >
      <div style={{ marginBottom: 32 }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: COLORS.inkMuted,
            marginBottom: 8,
          }}
        >
          Learn · Search
        </div>
        <h1
          style={{
            fontFamily: FONTS.serif,
            fontSize: 38,
            fontWeight: 500,
            lineHeight: 1.1,
            letterSpacing: "-0.4px",
            margin: 0,
          }}
        >
          Search the substrate
        </h1>
        <p
          style={{
            marginTop: 12,
            fontSize: 14,
            color: COLORS.inkSec,
            lineHeight: 1.5,
          }}
        >
          Hybrid vector + editorial search across concept cards, microsector briefs,
          brief blocks, and learning paths.
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
          placeholder="Try “Marginal Loss Factor” or “REZ connection queue”"
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
            border: `1px solid ${COLORS.forest}`,
            background: COLORS.forest,
            color: COLORS.surface,
            cursor: "pointer",
          }}
        >
          Search
        </button>
      </form>

      {query.length === 0 && (
        <div style={{ color: COLORS.inkMuted, fontSize: 14 }}>
          Enter a query above to search across the Learn substrate.
        </div>
      )}

      {query.length > 0 && results.length === 0 && (
        <div style={{ color: COLORS.inkSec, fontSize: 14, lineHeight: 1.5 }}>
          No matches for <strong>{query}</strong>. Try a broader term or browse{" "}
          <Link href="/learn/concepts" style={{ color: COLORS.forest }}>
            concept cards
          </Link>{" "}
          directly.
        </div>
      )}

      {GROUP_ORDER.map((contentType) => {
        const bucket = grouped.get(contentType);
        if (!bucket || bucket.length === 0) return null;
        return (
          <section key={contentType} style={{ marginBottom: 40 }}>
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
                  key={`${item.content_type}:${item.source_id}`}
                  style={{ padding: "14px 0", borderBottom: `1px solid ${COLORS.borderLight}` }}
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
  );
}
