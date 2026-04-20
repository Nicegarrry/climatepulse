"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { COLORS, FONTS } from "@/lib/design-tokens";
import { EditorialStatusBadge, type EditorialStatus } from "./editorial-status-badge";

interface ConceptPreview {
  id: string;
  slug: string;
  term: string;
  abbrev: string | null;
  inline_summary: string;
  editorial_status: EditorialStatus;
  primary_domain: string | null;
  reviewed_at: string | null;
}

interface SeenContextValue {
  hasSeen: (slug: string) => boolean;
  markSeen: (slug: string) => void;
}

const SeenContext = createContext<SeenContextValue | null>(null);

/**
 * Scope the "first occurrence per slug" rule. Wrap a rendered article / Q&A
 * answer in this provider so a fresh render starts a fresh seen-set.
 */
export function ConceptTooltipScope({ children }: { children: ReactNode }) {
  const ref = useRef<Set<string>>(new Set());
  const value = useMemo<SeenContextValue>(
    () => ({
      hasSeen: (slug) => ref.current.has(slug),
      markSeen: (slug) => {
        ref.current.add(slug);
      },
    }),
    [],
  );
  return <SeenContext.Provider value={value}>{children}</SeenContext.Provider>;
}

interface Props {
  slug: string;
  context?: string;
  children: ReactNode;
}

/**
 * Inline concept reference with first-occurrence-only tooltip.
 * Desktop: popover on hover/focus. Mobile: modal sheet on tap.
 */
export function InlineConceptTooltip({ slug, context, children }: Props) {
  const scope = useContext(SeenContext);
  const shouldRender = !scope || !scope.hasSeen(slug);
  useEffect(() => {
    if (shouldRender) scope?.markSeen(slug);
  }, [scope, slug, shouldRender]);

  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<ConceptPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 640px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const ensureLoaded = useCallback(async () => {
    if (preview || loading) return;
    setLoading(true);
    try {
      const qs = context ? `?context=${encodeURIComponent(context)}` : "";
      const res = await fetch(`/api/learn/concepts/${encodeURIComponent(slug)}${qs}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { concept: ConceptPreview };
      setPreview(data.concept);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [slug, context, preview, loading]);

  const openTip = useCallback(() => {
    setOpen(true);
    void ensureLoaded();
  }, [ensureLoaded]);

  const closeTip = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeTip();
        triggerRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeTip]);

  if (!shouldRender) {
    return <>{children}</>;
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openTip}
        onMouseEnter={!isMobile ? openTip : undefined}
        onMouseLeave={!isMobile ? closeTip : undefined}
        onFocus={openTip}
        onBlur={!isMobile ? closeTip : undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-describedby={open ? `concept-tip-${slug}` : undefined}
        style={{
          all: "unset",
          cursor: "help",
          borderBottom: `1px dotted ${COLORS.forestMid}`,
          color: "inherit",
          padding: 0,
        }}
      >
        {children}
      </button>

      {open && isMobile && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`About ${preview?.term ?? slug}`}
          onClick={closeTip}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            zIndex: 1000,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: COLORS.surface,
              maxHeight: "75vh",
              width: "100%",
              borderTopLeftRadius: 12,
              borderTopRightRadius: 12,
              padding: "20px 20px 28px",
              overflowY: "auto",
              fontFamily: FONTS.sans,
            }}
          >
            <Inner
              preview={preview}
              loading={loading}
              error={error}
              onClose={closeTip}
            />
          </div>
        </div>
      )}

      {open && !isMobile && (
        <div
          id={`concept-tip-${slug}`}
          role="tooltip"
          style={{
            position: "absolute",
            marginTop: 6,
            zIndex: 1000,
            background: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
            padding: "12px 14px",
            minWidth: 260,
            maxWidth: 360,
            borderRadius: 4,
            fontFamily: FONTS.sans,
          }}
        >
          <Inner preview={preview} loading={loading} error={error} />
        </div>
      )}
    </>
  );
}

function Inner({
  preview,
  loading,
  error,
  onClose,
}: {
  preview: ConceptPreview | null;
  loading: boolean;
  error: string | null;
  onClose?: () => void;
}) {
  if (loading) {
    return <div style={{ color: COLORS.inkMuted, fontSize: 13 }}>Loading…</div>;
  }
  if (error || !preview) {
    return (
      <div style={{ color: COLORS.inkSec, fontSize: 13 }}>
        Couldn&rsquo;t load this concept.
      </div>
    );
  }
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 4,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.serif,
            fontSize: 18,
            fontWeight: 500,
            color: COLORS.ink,
            lineHeight: 1.2,
          }}
        >
          {preview.term}
          {preview.abbrev ? (
            <span
              style={{
                color: COLORS.inkMuted,
                fontWeight: 400,
                fontSize: 14,
                marginLeft: 6,
              }}
            >
              ({preview.abbrev})
            </span>
          ) : null}
        </div>
        <EditorialStatusBadge status={preview.editorial_status} compact />
      </div>
      <p
        style={{
          fontSize: 13,
          lineHeight: 1.5,
          color: COLORS.inkSec,
          margin: "8px 0",
        }}
      >
        {preview.inline_summary}
      </p>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <a
          href={`/learn/concepts/${preview.slug}`}
          style={{
            fontSize: 12,
            color: COLORS.forest,
            fontFamily: FONTS.sans,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Full card →
        </a>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            style={{
              all: "unset",
              cursor: "pointer",
              fontSize: 12,
              color: COLORS.inkSec,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}
