"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { COLORS, FONTS } from "@/lib/design-tokens";
import { Micro, WobblyRule } from "@/components/intelligence/primitives";
import type {
  WeeklyDigest,
  WeeklyReport,
  WeeklyCuratedStory,
  WeeklyThemeCluster,
} from "@/lib/types";
import { ReportViewer } from "./report-viewer";
import { StoryPicker } from "./story-picker";
import { DigestComposer } from "./digest-composer";
import { PreviewPanel } from "./preview-panel";
import { DailyReviewPanel } from "./daily-review";
import { ActivityLogPanel } from "./activity-log-panel";
import { IndicatorReviewPanel } from "./indicator-review-panel";
import { SourceHealthDot } from "./source-health-dot";
import { CollapsibleSection } from "./collapsible-section";
import { BriefingPackView } from "./briefing-pack-view";
import { ArchetypePreviewSwitcher } from "./archetype-preview-switcher";
import { currentWeekRange, formatWeekLabel } from "./helpers";
import type { EditorArticle } from "./types";

// ─── Helpers ──────────────────────────────────────────────────────────────

function articleToCuratedStory(a: EditorArticle): WeeklyCuratedStory {
  const pm = a.quantitative_data?.primary_metric ?? null;
  const delta = a.quantitative_data?.delta ?? null;
  return {
    article_id: a.id,
    headline: a.title,
    source: a.source,
    url: a.url,
    editor_take: "",
    severity:
      a.sentiment === "negative"
        ? "alert"
        : a.sentiment === "positive"
        ? "ready"
        : "watch",
    sector: (a.domain ?? "GENERAL").replace(/-/g, " ").toUpperCase(),
    key_metric: pm
      ? {
          value: pm.value,
          unit: pm.unit,
          ...(delta ? { delta: `${delta.value} ${delta.unit}` } : {}),
        }
      : undefined,
  };
}

function clusterToCuratedStory(cluster: WeeklyThemeCluster): WeeklyCuratedStory {
  const top = cluster.articles[0];
  const km = cluster.key_numbers[0];
  return {
    article_id: top?.id,
    headline: top?.title ?? cluster.label,
    source: top?.source ?? "Climate Pulse",
    url: top?.url ?? "",
    editor_take: "",
    severity: "watch",
    sector: cluster.domain.replace(/-/g, " ").toUpperCase(),
    key_metric: km ? { value: km.value, unit: km.unit } : undefined,
  };
}

function uniqueByHeadline(stories: WeeklyCuratedStory[]): WeeklyCuratedStory[] {
  const seen = new Set<string>();
  const result: WeeklyCuratedStory[] = [];
  for (const s of stories) {
    const key = (s.article_id ?? s.headline).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(s);
  }
  return result;
}

// ─── Main component ──────────────────────────────────────────────────────

export default function EditorTab() {
  const initialWeek = useMemo(() => currentWeekRange(), []);

  const [draft, setDraft] = useState<Partial<WeeklyDigest>>(() => ({
    week_start: initialWeek.start,
    week_end: initialWeek.end,
    status: "draft",
    headline: "",
    editor_narrative: "",
    weekly_number: null,
    curated_stories: [],
    theme_commentary: null,
    outlook: null,
  }));

  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<"compose" | "preview">("compose");

  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{
    published: boolean;
    digest_id: string;
    linkedin_draft: string | null;
    emails_sent: number;
  } | null>(null);
  const [toast, setToast] = useState<{ message: string; kind: "success" | "error" } | null>(null);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstLoadRef = useRef(true);

  // ─── Load latest report + existing draft for current week ───────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [reportRes, digestRes] = await Promise.all([
          fetch("/api/weekly/reports?limit=1"),
          fetch("/api/weekly/digests?status=all&limit=50"),
        ]);

        const reportData = reportRes.ok ? await reportRes.json() : { reports: [] };
        const digestData = digestRes.ok ? await digestRes.json() : { digests: [] };

        if (!mounted) return;

        const latestReport: WeeklyReport | null = reportData.reports?.[0] ?? null;
        setReport(latestReport);

        // Find an existing draft/digest for this week
        const existing: WeeklyDigest | undefined = digestData.digests?.find(
          (d: WeeklyDigest) => d.week_start === initialWeek.start
        );
        if (existing) {
          setDraft(normaliseDigest(existing));
        }
      } catch (err) {
        console.warn("Editor load failed:", err);
      } finally {
        if (mounted) {
          setLoading(false);
          firstLoadRef.current = false;
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [initialWeek.start]);

  // ─── Auto-save (debounced) ───────────────────────────────────────────
  const saveDraft = useCallback(
    async (currentDraft: Partial<WeeklyDigest>): Promise<WeeklyDigest | null> => {
      if (!currentDraft.week_start || !currentDraft.headline || !currentDraft.editor_narrative) {
        // Don't attempt save until required fields are present
        return null;
      }
      try {
        setSaveStatus("saving");
        setSaving(true);
        // POST handles upsert-by-week_start
        const res = await fetch("/api/weekly/digests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            week_start: currentDraft.week_start,
            week_end: currentDraft.week_end,
            headline: currentDraft.headline,
            editor_narrative: currentDraft.editor_narrative,
            weekly_number: currentDraft.weekly_number ?? null,
            curated_stories: currentDraft.curated_stories ?? [],
            theme_commentary: currentDraft.theme_commentary ?? null,
            outlook: currentDraft.outlook ?? null,
            report_id: currentDraft.report_id ?? null,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Save failed (${res.status})`);
        }
        const body = await res.json();
        const saved: WeeklyDigest = body.digest;
        setSaveStatus("saved");
        return saved;
      } catch (err) {
        console.warn("save draft:", err);
        setSaveStatus("error");
        return null;
      } finally {
        setSaving(false);
      }
    },
    []
  );

  // Debounced auto-save on draft changes (2s)
  useEffect(() => {
    if (loading || firstLoadRef.current) return;
    if (!draft.headline && !draft.editor_narrative) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const saved = await saveDraft(draft);
      if (saved) {
        setDraft((prev) => ({
          ...prev,
          id: saved.id,
          report_id: saved.report_id,
          status: saved.status,
        }));
      }
    }, 2000);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    draft.headline,
    draft.editor_narrative,
    draft.week_start,
    draft.week_end,
    draft.weekly_number,
    draft.curated_stories,
    draft.outlook,
    draft.theme_commentary,
    loading,
  ]);

  // ─── Handlers ───────────────────────────────────────────────────────
  const handleChange = useCallback((updates: Partial<WeeklyDigest>) => {
    setDraft((prev) => ({ ...prev, ...updates }));
    setSaveStatus("idle");
  }, []);

  const handleManualSave = useCallback(async () => {
    const saved = await saveDraft(draft);
    if (saved) {
      setDraft((prev) => ({ ...prev, id: saved.id, status: saved.status }));
      setToast({ message: "Draft saved.", kind: "success" });
      setTimeout(() => setToast(null), 2500);
    }
  }, [draft, saveDraft]);

  const addArticlesToDigest = useCallback((articles: EditorArticle[]) => {
    setDraft((prev) => {
      const existing = prev.curated_stories ?? [];
      const added = articles.map(articleToCuratedStory);
      const merged = uniqueByHeadline([...existing, ...added]);
      return { ...prev, curated_stories: merged };
    });
  }, []);

  const useReportAsBasis = useCallback((r: WeeklyReport) => {
    const stories = r.theme_clusters.slice(0, 6).map(clusterToCuratedStory);
    setDraft((prev) => ({
      ...prev,
      report_id: r.id,
      week_start: r.week_start,
      week_end: r.week_end,
      theme_commentary:
        prev.theme_commentary ??
        r.theme_clusters.slice(0, 3).map((c) => ({
          theme_label: c.label,
          commentary: "",
        })),
      curated_stories: uniqueByHeadline([...(prev.curated_stories ?? []), ...stories]),
    }));
    setToast({ message: "Report applied as basis.", kind: "success" });
    setTimeout(() => setToast(null), 2500);
  }, []);

  const handlePublish = useCallback(async () => {
    if (!draft.id) {
      // Force a save first so we have an id
      const saved = await saveDraft(draft);
      if (!saved) {
        setToast({ message: "Could not save draft before publish.", kind: "error" });
        return;
      }
      setDraft((prev) => ({ ...prev, id: saved.id }));
      setPublishModalOpen(true);
      return;
    }
    setPublishModalOpen(true);
  }, [draft, saveDraft]);

  const confirmPublish = useCallback(async () => {
    if (!draft.id) return;
    setPublishing(true);
    try {
      const res = await fetch(`/api/weekly/digests/${draft.id}/publish`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Publish failed (${res.status})`);
      }
      const body = await res.json();
      setPublishResult(body);
      setDraft((prev) => ({ ...prev, status: "published" }));
      setToast({ message: "Digest published.", kind: "success" });
      setTimeout(() => setToast(null), 3500);
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Publish failed.",
        kind: "error",
      });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setPublishing(false);
    }
  }, [draft.id]);

  const canPublish = Boolean(
    draft.headline &&
      draft.editor_narrative &&
      draft.curated_stories &&
      draft.curated_stories.length > 0 &&
      draft.status !== "published"
  );

  // ─── Render ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: 32, color: COLORS.inkMuted }}>
        <Micro>{"Loading editor\u2026"}</Micro>
      </div>
    );
  }

  return (
    <div
      style={{
        fontFamily: FONTS.sans,
        maxWidth: 1400,
        margin: "0 auto",
      }}
      className="paper-grain"
    >
      {/* Header */}
      <div style={{ padding: "8px 4px 4px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: FONTS.serif,
                fontSize: 28,
                fontWeight: 400,
                color: COLORS.ink,
                margin: 0,
                letterSpacing: -0.6,
                lineHeight: 1.1,
              }}
            >
              Editor
            </h1>
            <div style={{ marginTop: 5, display: "flex", alignItems: "baseline", gap: 10 }}>
              <Micro>Weekly Digest Composer</Micro>
              <span style={{ fontSize: 11, color: COLORS.inkFaint, fontVariantNumeric: "tabular-nums" }}>
                {draft.week_start && draft.week_end
                  ? formatWeekLabel(draft.week_start, draft.week_end)
                  : ""}
              </span>
              {draft.status && (
                <StatusBadge status={draft.status} />
              )}
            </div>
          </div>

          {/* Mobile view toggle */}
          <div className="lg:hidden" style={{ display: "flex", gap: 4 }}>
            <button
              onClick={() => setView("compose")}
              style={{ ...toggleBtn, ...(view === "compose" ? toggleActive : {}) }}
            >
              Compose
            </button>
            <button
              onClick={() => setView("preview")}
              style={{ ...toggleBtn, ...(view === "preview" ? toggleActive : {}) }}
            >
              Preview
            </button>
          </div>
        </div>
        <div style={{ margin: "14px 0 18px" }}>
          <WobblyRule />
        </div>
      </div>

      {/* Daily editorial controls (post-publish edits) + activity log */}
      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "minmax(0, 1fr)",
          marginBottom: 18,
        }}
        className="daily-grid"
      >
        <CollapsibleSection
          title="Today's Briefing"
          subtitle="Intervene on the live daily briefing"
          storageKey="daily-review"
          defaultOpen={true}
        >
          <DailyReviewPanel />
        </CollapsibleSection>
        <CollapsibleSection
          title="Activity"
          subtitle="Today's editorial actions"
          storageKey="activity-log"
          defaultOpen={true}
        >
          <ActivityLogPanel />
        </CollapsibleSection>
      </div>

      <div style={{ marginBottom: 18 }}>
        <CollapsibleSection
          title="Indicator Review"
          subtitle="Detector hints awaiting approval"
          storageKey="indicator-review"
          defaultOpen={false}
        >
          <IndicatorReviewPanel />
        </CollapsibleSection>
      </div>

      <div style={{ marginBottom: 18 }}>
        <CollapsibleSection
          title="Archetype Preview"
          subtitle="Commercial · Academic · Policy · General"
          storageKey="archetype-preview"
          defaultOpen={false}
        >
          <ArchetypePreviewSwitcher />
        </CollapsibleSection>
      </div>

      {/* Content grid: desktop = split, mobile = toggle */}
      <div
        style={{
          display: "grid",
          gap: 18,
          gridTemplateColumns: "minmax(0, 1fr)",
        }}
        className="editor-grid"
      >
        {/* Compose column */}
        <div
          className={view === "preview" ? "lg:block hidden" : ""}
          style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}
        >
          <CollapsibleSection
            title="Weekly Report"
            subtitle="Auto-generated intelligence basis"
            storageKey="report-viewer"
            defaultOpen={true}
          >
            <ReportViewer report={report} onUseAsBasis={useReportAsBasis} />
          </CollapsibleSection>
          <CollapsibleSection
            title="Briefing Pack"
            subtitle="Top-engaged, saves, picks, notes, RAG, angles"
            storageKey="briefing-pack"
            defaultOpen={false}
          >
            <BriefingPackView />
          </CollapsibleSection>
          <CollapsibleSection
            title="Story Picker"
            subtitle="Browse & add articles to the digest"
            storageKey="story-picker"
            defaultOpen={false}
          >
            <StoryPicker
              defaultFrom={initialWeek.start}
              defaultTo={initialWeek.end}
              onAddSelected={addArticlesToDigest}
            />
          </CollapsibleSection>
          <CollapsibleSection
            title="This Week's Editorial"
            subtitle="Headline, narrative, curated stories"
            storageKey="digest-composer"
            defaultOpen={true}
          >
            <DigestComposer
              value={draft}
              onChange={handleChange}
              onSave={handleManualSave}
              onPublish={handlePublish}
              saving={saving}
              saveStatus={saveStatus}
              canPublish={canPublish}
            />
          </CollapsibleSection>
        </div>

        {/* Preview column */}
        <div
          className={view === "compose" ? "lg:block hidden" : ""}
          style={{ minWidth: 0 }}
        >
          <CollapsibleSection
            title="Preview"
            subtitle="What the reader will see"
            storageKey="preview-panel"
            defaultOpen={true}
          >
            <PreviewPanel draft={draft} />
          </CollapsibleSection>
        </div>
      </div>

      {/* Publish modal */}
      {publishModalOpen && (
        <PublishModal
          publishing={publishing}
          result={publishResult}
          onConfirm={confirmPublish}
          onClose={() => {
            setPublishModalOpen(false);
            setPublishResult(null);
          }}
          digestHeadline={draft.headline ?? ""}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            padding: "10px 14px",
            background: toast.kind === "success" ? COLORS.forest : "#8B2E2E",
            color: "#fff",
            borderRadius: 6,
            fontFamily: FONTS.sans,
            fontSize: 13,
            fontWeight: 500,
            boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
            zIndex: 60,
          }}
        >
          {toast.message}
        </div>
      )}

      {/* Desktop split-layout styles */}
      <style jsx>{`
        @media (min-width: 1024px) {
          :global(.editor-grid) {
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          }
          :global(.daily-grid) {
            grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
          }
        }
      `}</style>

      {/* Persistent corner widget — source health */}
      <SourceHealthDot />
    </div>
  );
}

/* ── Status badge ───────────────────────────────────────────────────── */

function StatusBadge({ status }: { status: string }) {
  const palette =
    status === "published"
      ? { bg: COLORS.sageTint, fg: COLORS.forest }
      : status === "archived"
      ? { bg: COLORS.paperDark, fg: COLORS.inkMuted }
      : { bg: COLORS.plumLight, fg: COLORS.plum };
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: 1,
        textTransform: "uppercase",
        padding: "2px 7px",
        borderRadius: 10,
        background: palette.bg,
        color: palette.fg,
      }}
    >
      {status}
    </span>
  );
}

/* ── Publish modal ──────────────────────────────────────────────────── */

interface PublishModalProps {
  publishing: boolean;
  result: {
    published: boolean;
    digest_id: string;
    linkedin_draft: string | null;
    emails_sent: number;
  } | null;
  onConfirm: () => void;
  onClose: () => void;
  digestHeadline: string;
}

function PublishModal({
  publishing,
  result,
  onConfirm,
  onClose,
  digestHeadline,
}: PublishModalProps) {
  const [copied, setCopied] = useState(false);

  const copyLinkedIn = useCallback(() => {
    if (!result?.linkedin_draft) return;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(result.linkedin_draft).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }, [result]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(26,26,26,0.45)",
        zIndex: 70,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: COLORS.surface,
          borderRadius: 10,
          border: `1px solid ${COLORS.border}`,
          maxWidth: 580,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: 22,
          fontFamily: FONTS.sans,
          boxShadow: "0 16px 40px rgba(26,26,26,0.25)",
        }}
      >
        {!result ? (
          <>
            <h2
              style={{
                fontFamily: FONTS.serif,
                fontSize: 22,
                margin: 0,
                color: COLORS.ink,
                letterSpacing: -0.4,
              }}
            >
              Publish Weekly Digest?
            </h2>
            <p style={{ marginTop: 10, fontSize: 13, color: COLORS.inkSec, lineHeight: 1.55 }}>
              You are about to publish <strong>{digestHeadline || "this digest"}</strong>.
              This will:
            </p>
            <ul style={{ fontSize: 13, color: COLORS.inkSec, lineHeight: 1.7, paddingLeft: 20 }}>
              <li>Send an email to subscribed readers</li>
              <li>Show the Weekly Pulse banner on the dashboard for 48 hours</li>
              <li>Generate a LinkedIn post draft for copy/paste</li>
            </ul>
            <div style={{ marginTop: 18, display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={onClose} style={secondaryBtn} disabled={publishing}>
                Cancel
              </button>
              <button onClick={onConfirm} style={publishBtn} disabled={publishing}>
                {publishing ? "Publishing\u2026" : "Publish now"}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2
              style={{
                fontFamily: FONTS.serif,
                fontSize: 22,
                margin: 0,
                color: COLORS.ink,
                letterSpacing: -0.4,
              }}
            >
              Published
            </h2>
            <p style={{ marginTop: 8, fontSize: 13, color: COLORS.inkSec }}>
              {result.emails_sent > 0
                ? `Digest emailed to ${result.emails_sent} subscriber${result.emails_sent === 1 ? "" : "s"}.`
                : "Digest is live. Email dispatch is disabled (no RESEND_API_KEY)."}
            </p>

            {result.linkedin_draft ? (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <Micro>LinkedIn Draft</Micro>
                  <button onClick={copyLinkedIn} style={secondaryBtn}>
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <textarea
                  readOnly
                  value={result.linkedin_draft}
                  rows={10}
                  style={{
                    width: "100%",
                    marginTop: 8,
                    padding: 10,
                    fontFamily: FONTS.sans,
                    fontSize: 13,
                    lineHeight: 1.5,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 6,
                    background: COLORS.paperDark,
                    color: COLORS.ink,
                    resize: "vertical",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            ) : (
              <p style={{ marginTop: 12, fontSize: 12, color: COLORS.inkMuted }}>
                No LinkedIn draft generated (GOOGLE_AI_API_KEY not configured).
              </p>
            )}

            <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end" }}>
              <button onClick={onClose} style={primaryBtn}>
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Normalisation ──────────────────────────────────────────────────── */

// Supabase/pg may return JSONB columns as strings. Normalise to the expected
// shape so the composer can work with native objects.
function normaliseDigest(d: WeeklyDigest): Partial<WeeklyDigest> {
  return {
    ...d,
    weekly_number:
      typeof d.weekly_number === "string" ? JSON.parse(d.weekly_number) : d.weekly_number,
    curated_stories:
      typeof d.curated_stories === "string" ? JSON.parse(d.curated_stories) : d.curated_stories,
    theme_commentary:
      typeof d.theme_commentary === "string" ? JSON.parse(d.theme_commentary) : d.theme_commentary,
  };
}

/* ── Styles ─────────────────────────────────────────────────────────── */

const toggleBtn: React.CSSProperties = {
  fontFamily: FONTS.sans,
  fontSize: 11,
  fontWeight: 600,
  padding: "6px 12px",
  background: "transparent",
  color: COLORS.inkMuted,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 5,
  cursor: "pointer",
  textTransform: "uppercase",
  letterSpacing: 0.8,
};

const toggleActive: React.CSSProperties = {
  background: COLORS.sageTint,
  color: COLORS.forest,
  borderColor: COLORS.forestMid,
};

const primaryBtn: React.CSSProperties = {
  fontFamily: FONTS.sans,
  fontSize: 13,
  fontWeight: 600,
  padding: "8px 16px",
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
  padding: "6px 12px",
  background: COLORS.surface,
  color: COLORS.inkSec,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 5,
  cursor: "pointer",
};

const publishBtn: React.CSSProperties = {
  fontFamily: FONTS.sans,
  fontSize: 13,
  fontWeight: 600,
  padding: "8px 16px",
  background: COLORS.plum,
  color: "#fff",
  border: "none",
  borderRadius: 5,
  cursor: "pointer",
};
