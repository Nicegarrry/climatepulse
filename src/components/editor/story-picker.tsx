"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { COLORS, FONTS } from "@/lib/design-tokens";
import { Micro, WobblyRule } from "@/components/intelligence/primitives";
import type { EditorArticle } from "./types";

interface StoryPickerProps {
  defaultFrom: string;
  defaultTo: string;
  onAddSelected: (articles: EditorArticle[]) => void;
}

const DOMAIN_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All domains" },
  { value: "energy-generation", label: "Energy \u2014 Generation" },
  { value: "energy-storage", label: "Energy \u2014 Storage" },
  { value: "energy-grid", label: "Energy \u2014 Grid" },
  { value: "carbon-emissions", label: "Carbon & Emissions" },
  { value: "transport", label: "Transport" },
  { value: "industry", label: "Industry" },
  { value: "agriculture", label: "Agriculture" },
  { value: "built-environment", label: "Built Environment" },
  { value: "critical-minerals", label: "Critical Minerals" },
  { value: "finance", label: "Finance" },
  { value: "policy", label: "Policy" },
  { value: "workforce-adaptation", label: "Workforce & Adaptation" },
];

export function StoryPicker({
  defaultFrom,
  defaultTo,
  onAddSelected,
}: StoryPickerProps) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [domain, setDomain] = useState<string>("all");
  const [minSig, setMinSig] = useState<number>(40);
  const [articles, setArticles] = useState<EditorArticle[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const runSearch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        from,
        to,
        minSignificance: String(minSig),
        limit: "100",
      });
      if (domain && domain !== "all") qs.set("domain", domain);
      const res = await fetch(`/api/weekly/articles?${qs.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }
      const data = await res.json();
      setArticles(data.articles ?? []);
      setHasSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load articles");
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, [from, to, domain, minSig]);

  useEffect(() => {
    // Auto-run one search on mount so editor has results immediately.
    void runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleAdd = useCallback(() => {
    const picked = articles.filter((a) => selectedIds.has(a.id));
    if (picked.length === 0) return;
    onAddSelected(picked);
    setSelectedIds(new Set());
  }, [articles, selectedIds, onAddSelected]);

  const selectedCount = selectedIds.size;
  const countLabel = useMemo(
    () => `${articles.length} article${articles.length === 1 ? "" : "s"}`,
    [articles.length]
  );

  return (
    <div
      style={{
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 10,
        padding: 18,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <Micro>Story Picker</Micro>
        <span style={{ fontSize: 11, color: COLORS.inkFaint, fontVariantNumeric: "tabular-nums" }}>
          {countLabel}
        </span>
      </div>
      <WobblyRule color={COLORS.borderLight} />

      {/* Filters */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10,
          marginTop: 14,
        }}
      >
        <LabelledField label="From">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            style={inputStyle}
          />
        </LabelledField>
        <LabelledField label="To">
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            style={inputStyle}
          />
        </LabelledField>
        <LabelledField label="Domain">
          <select
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            style={inputStyle}
          >
            {DOMAIN_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </LabelledField>
        <LabelledField label={`Min significance (${minSig})`}>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={minSig}
            onChange={(e) => setMinSig(parseInt(e.target.value, 10))}
            style={{ width: "100%" }}
          />
        </LabelledField>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={() => void runSearch()} style={primaryBtn} disabled={loading}>
          {loading ? "Searching\u2026" : "Search"}
        </button>
        <button
          onClick={handleAdd}
          style={{ ...secondaryBtn, opacity: selectedCount === 0 ? 0.5 : 1 }}
          disabled={selectedCount === 0}
        >
          Add {selectedCount > 0 ? `${selectedCount} ` : ""}selected to digest
        </button>
      </div>

      {error && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 12px",
            background: "#FDECEA",
            color: "#8B2E2E",
            borderRadius: 6,
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      {/* Results */}
      <div style={{ marginTop: 14 }}>
        {loading ? (
          <SkeletonList />
        ) : articles.length === 0 ? (
          <EmptyResults searched={hasSearched} />
        ) : (
          articles.map((a) => (
            <ArticleRow
              key={a.id}
              article={a}
              selected={selectedIds.has(a.id)}
              onToggle={() => toggle(a.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

/* ── Presentational helpers ─────────────────────────────────────────── */

function LabelledField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span
        style={{
          fontSize: 10,
          fontFamily: FONTS.sans,
          textTransform: "uppercase",
          letterSpacing: 1.2,
          color: COLORS.inkMuted,
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function ArticleRow({
  article,
  selected,
  onToggle,
}: {
  article: EditorArticle;
  selected: boolean;
  onToggle: () => void;
}) {
  const sigColor =
    article.significance >= 75
      ? COLORS.forest
      : article.significance >= 55
      ? COLORS.forestMid
      : COLORS.inkMuted;

  return (
    <div
      onClick={onToggle}
      style={{
        display: "grid",
        gridTemplateColumns: "20px 1fr auto",
        gap: 12,
        alignItems: "start",
        padding: "10px 12px",
        marginBottom: 6,
        borderRadius: 6,
        cursor: "pointer",
        background: selected ? COLORS.sageTint : COLORS.paperDark,
        border: `1px solid ${selected ? COLORS.forestMid : COLORS.borderLight}`,
        transition: "background 120ms ease, border-color 120ms ease",
      }}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        onClick={(e) => e.stopPropagation()}
        style={{ marginTop: 3, cursor: "pointer" }}
      />
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontFamily: FONTS.serif,
            fontSize: 14,
            color: COLORS.ink,
            lineHeight: 1.35,
            letterSpacing: -0.1,
          }}
        >
          {article.title}
        </div>
        <div
          style={{
            marginTop: 4,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 8,
            fontSize: 10,
            color: COLORS.inkMuted,
          }}
        >
          <span>{article.source}</span>
          {article.domain && <Pill>{article.domain}</Pill>}
          {article.signal_type && <Pill>{article.signal_type.replace(/_/g, " ")}</Pill>}
          {article.sentiment && <Pill>{article.sentiment}</Pill>}
          {article.published_at && (
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {new Date(article.published_at).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
            </span>
          )}
        </div>
      </div>
      <div
        style={{
          fontVariantNumeric: "tabular-nums",
          fontSize: 14,
          fontWeight: 600,
          color: sigColor,
          textAlign: "right",
          minWidth: 28,
        }}
      >
        {Math.round(article.significance)}
      </div>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        padding: "1px 6px",
        border: `1px solid ${COLORS.border}`,
        borderRadius: 10,
        background: COLORS.surface,
        fontSize: 9,
        textTransform: "uppercase",
        letterSpacing: 0.6,
        color: COLORS.inkSec,
      }}
    >
      {children}
    </span>
  );
}

function SkeletonList() {
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            height: 52,
            marginBottom: 6,
            background: COLORS.borderLight,
            borderRadius: 6,
            opacity: 0.6,
          }}
        />
      ))}
    </>
  );
}

function EmptyResults({ searched }: { searched: boolean }) {
  return (
    <div
      style={{
        padding: "28px 14px",
        textAlign: "center",
        color: COLORS.inkMuted,
        fontSize: 12,
      }}
    >
      {searched
        ? "No articles match the current filters. Widen the date range or lower significance."
        : "Set filters and click Search to find stories."}
    </div>
  );
}

/* ── Styles ─────────────────────────────────────────────────────────── */

const inputStyle: React.CSSProperties = {
  fontFamily: FONTS.sans,
  fontSize: 12,
  padding: "6px 8px",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 5,
  background: COLORS.surface,
  color: COLORS.ink,
  width: "100%",
};

const primaryBtn: React.CSSProperties = {
  fontFamily: FONTS.sans,
  fontSize: 12,
  fontWeight: 600,
  padding: "7px 14px",
  background: COLORS.forest,
  color: "#fff",
  border: "none",
  borderRadius: 5,
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  fontFamily: FONTS.sans,
  fontSize: 12,
  fontWeight: 500,
  padding: "7px 14px",
  background: COLORS.surface,
  color: COLORS.forest,
  border: `1px solid ${COLORS.forestMid}`,
  borderRadius: 5,
  cursor: "pointer",
};
