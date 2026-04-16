"use client";

import { useState, useRef, useCallback } from "react";
import { COLORS, FONTS } from "@/lib/design-tokens";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Micro } from "./primitives";

// ─── Types ────────────────────────────────────────────────────────────────────

type ContentType =
  | "article"
  | "podcast"
  | "daily_digest"
  | "weekly_digest"
  | "weekly_report";

interface RAGSource {
  content_type: ContentType;
  source_id: string;
  title: string;
  subtitle?: string | null;
  url?: string | null;
  published_at: string | null;
  similarity: number;
  significance_composite: number | null;
  primary_domain: string | null;
  trustworthiness_tier: number;
  chunk_text: string;
}

interface QueryResponse {
  answer: string;
  sources: RAGSource[];
  model_used: string;
  input_tokens?: number;
  output_tokens?: number;
  error?: string;
}

interface QueryFilters {
  content_types?: ContentType[];
  domains?: string[];
  signal_types?: string[];
  min_significance?: number;
  date_from?: string;
  date_to?: string;
}

const CONTENT_TYPE_OPTIONS: { value: ContentType; label: string }[] = [
  { value: "article", label: "Articles" },
  { value: "podcast", label: "Podcasts" },
  { value: "daily_digest", label: "Daily briefings" },
  { value: "weekly_digest", label: "Weekly Pulse" },
  { value: "weekly_report", label: "Weekly reports" },
];

const CONTENT_TYPE_BADGE: Record<ContentType, string> = {
  article: "ARTICLE",
  podcast: "PODCAST",
  daily_digest: "DAILY",
  weekly_digest: "WEEKLY",
  weekly_report: "REPORT",
};

const DOMAIN_OPTIONS = [
  { value: "energy-generation", label: "Energy Gen" },
  { value: "energy-storage", label: "Storage" },
  { value: "energy-grid", label: "Grid" },
  { value: "carbon-emissions", label: "Carbon" },
  { value: "transport", label: "Transport" },
  { value: "industry", label: "Industry" },
  { value: "agriculture", label: "Agriculture" },
  { value: "built-environment", label: "Built Env" },
  { value: "critical-minerals", label: "Minerals" },
  { value: "finance", label: "Finance" },
  { value: "policy", label: "Policy" },
  { value: "workforce-adaptation", label: "Workforce" },
];

const SIGNAL_OPTIONS = [
  { value: "market_move", label: "Market" },
  { value: "policy_change", label: "Policy" },
  { value: "project_milestone", label: "Project" },
  { value: "corporate_action", label: "Corporate" },
  { value: "technology_advance", label: "Tech" },
  { value: "enforcement", label: "Enforcement" },
  { value: "international", label: "International" },
];

const SUGGESTED_QUERIES = [
  "What's happening with lithium supply chains?",
  "How are carbon border adjustments affecting Australian industry?",
  "Latest solar farm approvals and project milestones",
  "Policy changes affecting energy storage this month",
  "Corporate actions in critical minerals sector",
];

// ─── Component ────────────────────────────────────────────────────────────────

export function ResearchPanel() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"research" | "brief">("brief");
  const [filters, setFilters] = useState<QueryFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<QueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<{ query: string; response: QueryResponse }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(async () => {
    const q = query.trim();
    if (!q || loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/intelligence/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q,
          mode,
          filters: {
            ...(filters.content_types?.length ? { content_types: filters.content_types } : {}),
            ...(filters.domains?.length ? { domains: filters.domains } : {}),
            ...(filters.signal_types?.length ? { signal_types: filters.signal_types } : {}),
            ...(filters.min_significance ? { min_significance: filters.min_significance } : {}),
            ...(filters.date_from ? { date_from: filters.date_from } : {}),
            ...(filters.date_to ? { date_to: filters.date_to } : {}),
          },
          limit: 15,
        }),
      });

      const data: QueryResponse = await res.json();

      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
      } else {
        setResponse(data);
        setHistory((prev) => [{ query: q, response: data }, ...prev.slice(0, 9)]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [query, mode, filters, loading]);

  const toggleDomain = (domain: string) => {
    setFilters((prev) => {
      const current = prev.domains ?? [];
      return {
        ...prev,
        domains: current.includes(domain)
          ? current.filter((d) => d !== domain)
          : [...current, domain],
      };
    });
  };

  const toggleSignal = (signal: string) => {
    setFilters((prev) => {
      const current = prev.signal_types ?? [];
      return {
        ...prev,
        signal_types: current.includes(signal)
          ? current.filter((s) => s !== signal)
          : [...current, signal],
      };
    });
  };

  const toggleContentType = (ct: ContentType) => {
    setFilters((prev) => {
      const current = prev.content_types ?? [];
      return {
        ...prev,
        content_types: current.includes(ct)
          ? current.filter((c) => c !== ct)
          : [...current, ct],
      };
    });
  };

  return (
    <div
      style={{
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 8,
        padding: "20px 24px",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h3
            style={{
              fontFamily: FONTS.serif,
              fontSize: 18,
              fontWeight: 600,
              color: COLORS.ink,
              margin: 0,
            }}
          >
            Research
          </h3>
          <span style={{ fontSize: 11, fontFamily: FONTS.sans, color: COLORS.inkMuted, marginTop: 2, display: "block" }}>
            Ask questions about your intelligence database
          </span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            onClick={() => setMode("brief")}
            style={{
              padding: "4px 10px",
              fontSize: 11,
              fontFamily: FONTS.sans,
              fontWeight: mode === "brief" ? 600 : 400,
              color: mode === "brief" ? COLORS.forest : COLORS.inkMuted,
              background: mode === "brief" ? COLORS.sageTint : "transparent",
              border: `1px solid ${mode === "brief" ? COLORS.sage : COLORS.borderLight}`,
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Quick
          </button>
          <button
            onClick={() => setMode("research")}
            style={{
              padding: "4px 10px",
              fontSize: 11,
              fontFamily: FONTS.sans,
              fontWeight: mode === "research" ? 600 : 400,
              color: mode === "research" ? COLORS.plum : COLORS.inkMuted,
              background: mode === "research" ? COLORS.plumLight : "transparent",
              border: `1px solid ${mode === "research" ? COLORS.plumMid : COLORS.borderLight}`,
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Deep Research
          </button>
        </div>
      </div>

      {/* Query input */}
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Ask about climate, energy, sustainability..."
          style={{
            flex: 1,
            fontFamily: FONTS.sans,
            fontSize: 14,
            borderColor: COLORS.border,
          }}
          disabled={loading}
        />
        <Button
          onClick={handleSubmit}
          disabled={loading || !query.trim()}
          style={{
            background: COLORS.forest,
            color: "#fff",
            fontFamily: FONTS.sans,
            fontSize: 13,
            fontWeight: 500,
            opacity: loading || !query.trim() ? 0.5 : 1,
          }}
        >
          {loading ? "Searching..." : "Ask"}
        </Button>
      </div>

      {/* Filter toggle + chips */}
      <div style={{ marginBottom: 12 }}>
        <button
          onClick={() => setShowFilters(!showFilters)}
          style={{
            fontSize: 11,
            fontFamily: FONTS.sans,
            color: COLORS.inkMuted,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            textDecoration: "underline",
          }}
        >
          {showFilters ? "Hide filters" : "Filters"}
          {(filters.content_types?.length || filters.domains?.length || filters.signal_types?.length || filters.min_significance) && " (active)"}
        </button>

        {showFilters && (
          <div style={{ marginTop: 8 }}>
            {/* Content type filters */}
            <Micro color={COLORS.inkSec} mb={4}>Content types</Micro>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
              {CONTENT_TYPE_OPTIONS.map((ct) => (
                <button
                  key={ct.value}
                  onClick={() => toggleContentType(ct.value)}
                  style={{
                    padding: "2px 8px",
                    fontSize: 11,
                    fontFamily: FONTS.sans,
                    color: filters.content_types?.includes(ct.value) ? COLORS.plum : COLORS.inkMuted,
                    background: filters.content_types?.includes(ct.value) ? COLORS.plumLight : "transparent",
                    border: `1px solid ${filters.content_types?.includes(ct.value) ? COLORS.plumMid : COLORS.borderLight}`,
                    borderRadius: 3,
                    cursor: "pointer",
                  }}
                >
                  {ct.label}
                </button>
              ))}
            </div>

            {/* Domain filters */}
            <Micro color={COLORS.inkSec} mb={4}>Domains</Micro>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
              {DOMAIN_OPTIONS.map((d) => (
                <button
                  key={d.value}
                  onClick={() => toggleDomain(d.value)}
                  style={{
                    padding: "2px 8px",
                    fontSize: 11,
                    fontFamily: FONTS.sans,
                    color: filters.domains?.includes(d.value) ? COLORS.forest : COLORS.inkMuted,
                    background: filters.domains?.includes(d.value) ? COLORS.sageTint : "transparent",
                    border: `1px solid ${filters.domains?.includes(d.value) ? COLORS.sage : COLORS.borderLight}`,
                    borderRadius: 3,
                    cursor: "pointer",
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>

            {/* Signal filters */}
            <Micro color={COLORS.inkSec} mb={4}>Signals</Micro>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
              {SIGNAL_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => toggleSignal(s.value)}
                  style={{
                    padding: "2px 8px",
                    fontSize: 11,
                    fontFamily: FONTS.sans,
                    color: filters.signal_types?.includes(s.value) ? COLORS.forest : COLORS.inkMuted,
                    background: filters.signal_types?.includes(s.value) ? COLORS.sageTint : "transparent",
                    border: `1px solid ${filters.signal_types?.includes(s.value) ? COLORS.sage : COLORS.borderLight}`,
                    borderRadius: 3,
                    cursor: "pointer",
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Significance threshold */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Micro color={COLORS.inkSec}>Min significance:</Micro>
              <input
                type="number"
                min={0}
                max={100}
                value={filters.min_significance ?? ""}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    min_significance: e.target.value ? parseInt(e.target.value) : undefined,
                  }))
                }
                placeholder="0"
                style={{
                  width: 60,
                  padding: "2px 6px",
                  fontSize: 12,
                  fontFamily: FONTS.sans,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 3,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Suggested queries (only before first query) */}
      {!response && !loading && !error && (
        <div style={{ marginBottom: 12 }}>
          <Micro color={COLORS.inkMuted} mb={6}>Try asking:</Micro>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {SUGGESTED_QUERIES.map((sq) => (
              <button
                key={sq}
                onClick={() => {
                  setQuery(sq);
                  inputRef.current?.focus();
                }}
                style={{
                  textAlign: "left",
                  padding: "6px 10px",
                  fontSize: 13,
                  fontFamily: FONTS.sans,
                  color: COLORS.inkSec,
                  background: COLORS.paperDark,
                  border: `1px solid ${COLORS.borderLight}`,
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              >
                {sq}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div
          style={{
            padding: "24px 0",
            textAlign: "center",
            fontFamily: FONTS.sans,
            fontSize: 13,
            color: COLORS.inkMuted,
          }}
        >
          <div style={{ marginBottom: 8 }}>
            {mode === "research" ? "Deep research in progress..." : "Searching intelligence database..."}
          </div>
          <div style={{ fontSize: 11, color: COLORS.inkFaint }}>
            {mode === "research"
              ? "Using Claude Sonnet for editorial-quality analysis"
              : "Using Gemini Flash for quick answers"}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          style={{
            padding: "12px 16px",
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: 6,
            fontFamily: FONTS.sans,
            fontSize: 13,
            color: "#991B1B",
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}

      {/* Response */}
      {response && !loading && (
        <div>
          {/* Answer */}
          <div
            style={{
              padding: "16px 20px",
              background: COLORS.paperDark,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 6,
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Micro color={COLORS.inkMuted}>
                {response.model_used.includes("claude") ? "CLAUDE SONNET" : "GEMINI FLASH"}
              </Micro>
              {response.input_tokens && (
                <Micro color={COLORS.inkFaint}>
                  {response.input_tokens.toLocaleString()} tokens in
                </Micro>
              )}
            </div>
            <div
              style={{
                fontFamily: FONTS.serif,
                fontSize: 15,
                lineHeight: 1.6,
                color: COLORS.ink,
                whiteSpace: "pre-wrap",
              }}
            >
              {response.answer}
            </div>
          </div>

          {/* Sources */}
          {response.sources.length > 0 && (
            <div>
              <Micro color={COLORS.inkMuted} mb={8}>
                SOURCES ({response.sources.length} items)
              </Micro>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {response.sources.map((source, i) => {
                  const isOwnEditorial = source.trustworthiness_tier === 0;
                  const cardStyle: React.CSSProperties = {
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    padding: "8px 12px",
                    background: isOwnEditorial ? COLORS.plumLight : COLORS.surface,
                    border: `1px solid ${isOwnEditorial ? COLORS.plumMid : COLORS.borderLight}`,
                    borderRadius: 4,
                    textDecoration: "none",
                    color: "inherit",
                  };

                  const inner = (
                    <>
                      <span
                        style={{
                          fontFamily: FONTS.sans,
                          fontSize: 11,
                          fontWeight: 600,
                          color: COLORS.inkMuted,
                          minWidth: 20,
                          paddingTop: 1,
                        }}
                      >
                        [{i + 1}]
                      </span>
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontFamily: FONTS.sans,
                            fontSize: 13,
                            fontWeight: 500,
                            color: COLORS.ink,
                            lineHeight: 1.3,
                          }}
                        >
                          {source.title}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            marginTop: 3,
                            alignItems: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          <Badge
                            variant="secondary"
                            style={{
                              fontSize: 9,
                              padding: "0 5px",
                              background: isOwnEditorial ? COLORS.plum : COLORS.paperDark,
                              color: isOwnEditorial ? "#fff" : COLORS.inkSec,
                              border: "none",
                            }}
                          >
                            {CONTENT_TYPE_BADGE[source.content_type]}
                          </Badge>
                          {source.subtitle && (
                            <Micro color={COLORS.inkMuted}>{source.subtitle}</Micro>
                          )}
                          {source.primary_domain && (
                            <Badge
                              variant="secondary"
                              style={{
                                fontSize: 9,
                                padding: "0 5px",
                                background: COLORS.sageTint,
                                color: COLORS.forest,
                                border: "none",
                              }}
                            >
                              {source.primary_domain.replace(/-/g, " ")}
                            </Badge>
                          )}
                          {source.significance_composite != null && (
                            <Micro color={COLORS.inkFaint}>
                              sig {source.significance_composite}
                            </Micro>
                          )}
                          <Micro color={COLORS.inkFaint}>
                            {Math.round(source.similarity * 100)}% match
                          </Micro>
                        </div>
                      </div>
                    </>
                  );

                  // If we have a URL (source articles, podcast audio), render as link
                  // Otherwise (our own digests/reports), render as non-clickable card
                  return source.url ? (
                    <a
                      key={`${source.content_type}:${source.source_id}`}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={cardStyle}
                    >
                      {inner}
                    </a>
                  ) : (
                    <div
                      key={`${source.content_type}:${source.source_id}`}
                      style={cardStyle}
                    >
                      {inner}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* History */}
      {history.length > 1 && !loading && (
        <div style={{ marginTop: 20, borderTop: `1px solid ${COLORS.borderLight}`, paddingTop: 12 }}>
          <Micro color={COLORS.inkMuted} mb={6}>RECENT QUERIES</Micro>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {history.slice(1).map((h, i) => (
              <button
                key={i}
                onClick={() => {
                  setQuery(h.query);
                  setResponse(h.response);
                }}
                style={{
                  textAlign: "left",
                  padding: "4px 8px",
                  fontSize: 12,
                  fontFamily: FONTS.sans,
                  color: COLORS.inkSec,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  borderRadius: 3,
                }}
              >
                {h.query}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
