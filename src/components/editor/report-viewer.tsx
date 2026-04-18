"use client";

import { useState } from "react";
import { COLORS, FONTS } from "@/lib/design-tokens";
import { Micro, WobblyRule } from "@/components/intelligence/primitives";
import type { WeeklyReport, WeeklyThemeCluster } from "@/lib/types";
import { formatWeekLabel } from "./helpers";

interface ReportViewerProps {
  report: WeeklyReport | null;
  onUseAsBasis: (report: WeeklyReport) => void;
  onGenerate: () => void;
  generating: boolean;
}

export function ReportViewer({ report, onUseAsBasis, onGenerate, generating }: ReportViewerProps) {
  if (!report) {
    return (
      <div
        style={{
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 10,
          padding: 18,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <Micro>Intelligence Report</Micro>
          <button
            onClick={onGenerate}
            disabled={generating}
            style={{
              fontFamily: FONTS.sans,
              fontSize: 12,
              fontWeight: 600,
              padding: "7px 14px",
              background: generating ? COLORS.inkFaint : COLORS.plum,
              color: "#fff",
              border: "none",
              borderRadius: 5,
              cursor: generating ? "wait" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {generating ? "Generating\u2026" : "Generate report"}
          </button>
        </div>
        <WobblyRule color={COLORS.borderLight} />
        <div
          style={{
            padding: "22px 10px",
            textAlign: "center",
            color: COLORS.inkMuted,
            fontSize: 13,
            lineHeight: 1.55,
          }}
        >
          No auto-generated report for this week yet.
          <div style={{ marginTop: 6, fontSize: 12, color: COLORS.inkFaint }}>
            Click <strong style={{ color: COLORS.plum }}>Generate report</strong> to cluster
            this week&rsquo;s enriched articles, or compose manually from the Story Picker below.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 10,
        padding: 18,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 6,
        }}
      >
        <div>
          <Micro>Intelligence Report</Micro>
          <div style={{ marginTop: 2, fontSize: 11, color: COLORS.inkFaint, fontVariantNumeric: "tabular-nums" }}>
            {formatWeekLabel(report.week_start, report.week_end)} {"\u00b7"} {report.model_used}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={onGenerate}
            disabled={generating}
            title="Re-run clustering for this week"
            style={{
              fontFamily: FONTS.sans,
              fontSize: 12,
              fontWeight: 600,
              padding: "7px 12px",
              background: generating ? COLORS.inkFaint : "transparent",
              color: generating ? "#fff" : COLORS.plum,
              border: `1px solid ${COLORS.plum}`,
              borderRadius: 5,
              cursor: generating ? "wait" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {generating ? "Generating\u2026" : "Regenerate"}
          </button>
          <button
            onClick={() => onUseAsBasis(report)}
            style={{
              fontFamily: FONTS.sans,
              fontSize: 12,
              fontWeight: 600,
              padding: "7px 12px",
              background: COLORS.forest,
              color: "#fff",
              border: "none",
              borderRadius: 5,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Use as basis
          </button>
        </div>
      </div>
      <WobblyRule color={COLORS.borderLight} />

      {/* Top numbers */}
      {report.top_numbers && report.top_numbers.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <Micro mb={6}>Top Numbers</Micro>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 8,
            }}
          >
            {report.top_numbers.map((n, i) => (
              <div
                key={i}
                style={{
                  padding: "10px 12px",
                  background: COLORS.paperDark,
                  border: `1px solid ${COLORS.borderLight}`,
                  borderRadius: 6,
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span
                    style={{
                      fontFamily: FONTS.serif,
                      fontSize: 22,
                      color: COLORS.plum,
                      fontVariantNumeric: "tabular-nums",
                      lineHeight: 1,
                    }}
                  >
                    {n.value}
                  </span>
                  <span style={{ fontSize: 11, color: COLORS.plumMid, fontWeight: 600 }}>{n.unit}</span>
                </div>
                <div style={{ marginTop: 4, fontSize: 11, color: COLORS.inkSec, lineHeight: 1.35 }}>
                  {n.context}
                </div>
                {n.delta && (
                  <div style={{ marginTop: 4, fontSize: 10, color: COLORS.forest, fontWeight: 600 }}>{n.delta}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Theme clusters */}
      {report.theme_clusters && report.theme_clusters.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <Micro mb={6}>Theme Clusters</Micro>
          {report.theme_clusters.map((c) => (
            <ClusterCard key={c.cluster_id} cluster={c} />
          ))}
        </div>
      )}

      {/* Sentiment summary */}
      {report.sentiment_summary && (
        <div style={{ marginTop: 18 }}>
          <Micro mb={6}>Sentiment by Domain</Micro>
          <div style={{ fontSize: 11, color: COLORS.inkSec, marginBottom: 8 }}>
            Overall:{" "}
            <span style={{ fontWeight: 600, color: COLORS.ink }}>{report.sentiment_summary.overall}</span>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 6,
            }}
          >
            {Object.entries(report.sentiment_summary.by_domain).map(([dom, counts]) => (
              <div
                key={dom}
                style={{
                  padding: "8px 10px",
                  background: COLORS.paperDark,
                  border: `1px solid ${COLORS.borderLight}`,
                  borderRadius: 6,
                  fontSize: 11,
                }}
              >
                <div style={{ color: COLORS.ink, fontWeight: 600, marginBottom: 3 }}>{dom}</div>
                <div style={{ color: COLORS.inkMuted, fontVariantNumeric: "tabular-nums" }}>
                  + {counts.positive ?? 0} &middot; {"\u2212"} {counts.negative ?? 0} &middot; ={" "}
                  {counts.neutral ?? 0} &middot; ~ {counts.mixed ?? 0}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ClusterCard({ cluster }: { cluster: WeeklyThemeCluster }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        marginBottom: 8,
        background: COLORS.paperDark,
        border: `1px solid ${COLORS.borderLight}`,
        borderRadius: 6,
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 12px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          fontFamily: FONTS.sans,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: FONTS.serif,
              fontSize: 14,
              color: COLORS.ink,
              letterSpacing: -0.1,
            }}
          >
            {cluster.label}
          </div>
          <div style={{ fontSize: 10, color: COLORS.inkMuted, marginTop: 2 }}>
            {cluster.articles.length} article{cluster.articles.length === 1 ? "" : "s"} &middot; {cluster.domain}
          </div>
        </div>
        <span style={{ fontSize: 11, color: COLORS.inkMuted }}>{open ? "\u2212" : "+"}</span>
      </button>
      {open && (
        <div style={{ padding: "0 12px 12px" }}>
          {cluster.entity_overlap.length > 0 && (
            <div style={{ marginBottom: 8, fontSize: 11, color: COLORS.inkSec }}>
              Shared entities:{" "}
              <span style={{ color: COLORS.ink }}>{cluster.entity_overlap.join(", ")}</span>
            </div>
          )}
          {cluster.key_numbers.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              {cluster.key_numbers.map((n, i) => (
                <div key={i} style={{ fontSize: 11, color: COLORS.inkSec }}>
                  <strong style={{ color: COLORS.plum }}>
                    {n.value} {n.unit}
                  </strong>{" "}
                  &mdash; {n.context}
                </div>
              ))}
            </div>
          )}
          {cluster.articles.map((a) => (
            <div
              key={a.id}
              style={{
                padding: "6px 8px",
                borderLeft: `2px solid ${COLORS.forestMid}`,
                marginBottom: 4,
                fontSize: 12,
                color: COLORS.inkSec,
              }}
            >
              <div style={{ color: COLORS.ink }}>{a.title}</div>
              <div style={{ fontSize: 10, color: COLORS.inkMuted, marginTop: 2 }}>
                {a.source} &middot; sig {Math.round(a.significance)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
