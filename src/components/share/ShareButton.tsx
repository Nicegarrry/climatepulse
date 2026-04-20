"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Share2, Mail, Link as LinkIcon, Check, X } from "lucide-react";

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.95v5.66H9.36V9h3.41v1.56h.05c.48-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.55C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

type ShareTarget = "linkedin" | "twitter";
type ShareSource = ShareTarget | "email" | "copy";
type ContentType = "story" | "podcast";

interface Props {
  // The ORIGINAL source URL (the journalism or audio file we're linking to).
  articleUrl: string;
  // Optional headline used to pre-populate share copy + preview.
  headline?: string;
  // Optional source-label (e.g. "AFR", "Reuters").
  sourceName?: string;
  // Optional campaign hint. Defaults to today's date (YYYY-MM-DD).
  campaign?: string;
  // Compact renders a tiny icon-only trigger; default is icon + "Share" label.
  compact?: boolean;
  // Optional content type override. Podcast episodes set this to "podcast".
  contentType?: ContentType;
  // Required when contentType === "podcast" so the blurb endpoint can look up
  // the episode directly.
  episodeId?: string;
}

interface DraftResult {
  blurb: string;
  share_url: string;
}

async function fetchDraft(
  target: ShareTarget,
  opts: {
    articleUrl: string;
    contentType: ContentType;
    episodeId?: string;
  }
): Promise<DraftResult | null> {
  try {
    const body: Record<string, unknown> = { target };
    if (opts.contentType === "podcast" && opts.episodeId) {
      body.episode_id = opts.episodeId;
    } else {
      body.article_url = opts.articleUrl;
    }
    const res = await fetch("/api/share/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as DraftResult;
    if (!data?.blurb || !data?.share_url) return null;
    return data;
  } catch {
    return null;
  }
}

async function fetchShareUrl(
  source: ShareSource,
  opts: {
    articleUrl: string;
    contentType: ContentType;
    episodeId?: string;
    campaign?: string;
  }
): Promise<string> {
  try {
    const body: Record<string, unknown> = {
      source,
      campaign: opts.campaign,
    };
    if (opts.contentType === "podcast" && opts.episodeId) {
      body.content_type = "podcast";
      body.episode_id = opts.episodeId;
    } else {
      body.article_url = opts.articleUrl;
    }
    const res = await fetch("/api/share/url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as { share_url?: string };
    return data.share_url ?? opts.articleUrl;
  } catch {
    return opts.articleUrl;
  }
}

function composeEmailBlurb(headline?: string, sourceName?: string): string {
  const hl = headline?.trim();
  if (!hl) return "From today's ClimatePulse briefing.";
  return sourceName
    ? `From today's ClimatePulse briefing: ${hl} — ${sourceName}`
    : `From today's ClimatePulse briefing: ${hl}`;
}

const LINKEDIN_COMPOSE = "https://www.linkedin.com/feed/?shareActive=true&text=";

function buildTargetHref(target: ShareTarget, text: string, shareUrl: string): string {
  const fullText = `${text}\n\n${shareUrl}`;
  if (target === "linkedin") {
    // LinkedIn's share-offsite ignores the text param. The feed compose URL
    // prefills the composer on desktop; on mobile we still need to copy first
    // (the overlay handles that), because the app often opens via deeplink
    // and loses the prefill.
    return `${LINKEDIN_COMPOSE}${encodeURIComponent(fullText)}`;
  }
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    text
  )}&url=${encodeURIComponent(shareUrl)}`;
}

// ─── Overlay ─────────────────────────────────────────────────────────────

function BlurbOverlay({
  target,
  loading,
  blurb,
  setBlurb,
  shareUrl,
  onCopyAndOpen,
  onClose,
}: {
  target: ShareTarget;
  loading: boolean;
  blurb: string;
  setBlurb: (v: string) => void;
  shareUrl: string;
  onCopyAndOpen: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  // Autofocus the textarea once the blurb finishes loading.
  useEffect(() => {
    if (!loading && ref.current) {
      ref.current.focus();
      ref.current.select();
    }
  }, [loading]);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const targetLabel = target === "linkedin" ? "LinkedIn" : "X / Twitter";
  const fullText = `${blurb}\n\n${shareUrl}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Share on ${targetLabel}`}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: "rgba(26,26,26,0.45)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: "clamp(12px, 4vw, 40px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 520,
          backgroundColor: "#FAF9F7",
          border: "1px solid #E8E5E0",
          borderRadius: 10,
          padding: "20px 22px 22px",
          fontFamily: "'Source Sans 3', system-ui, sans-serif",
          boxShadow: "0 20px 48px rgba(26,26,26,0.18)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "#1E4D2B",
                fontWeight: 600,
              }}
            >
              Share on {targetLabel}
            </div>
            <div style={{ fontSize: 12, color: "#5C5C5C", marginTop: 2 }}>
              Edit the draft, then copy &amp; open {targetLabel} to paste.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              border: "none",
              background: "transparent",
              padding: 6,
              cursor: "pointer",
              color: "#8C8C8C",
            }}
          >
            <X size={18} />
          </button>
        </div>

        <textarea
          ref={ref}
          value={loading ? "Drafting a post in your voice…" : blurb}
          disabled={loading}
          onChange={(e) => setBlurb(e.target.value)}
          rows={6}
          style={{
            width: "100%",
            boxSizing: "border-box",
            fontFamily: "'Source Sans 3', system-ui, sans-serif",
            fontSize: 14,
            lineHeight: 1.5,
            color: "#1A1A1A",
            backgroundColor: "#FFFFFF",
            border: "1px solid #E8E5E0",
            borderRadius: 6,
            padding: "12px 14px",
            resize: "vertical",
            outline: "none",
          }}
        />

        <div
          style={{
            marginTop: 8,
            fontSize: 11,
            color: "#8C8C8C",
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            wordBreak: "break-all",
          }}
        >
          {shareUrl}
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 16,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={onCopyAndOpen}
            disabled={loading || !blurb}
            style={{
              flex: "1 1 auto",
              padding: "11px 18px",
              backgroundColor: loading ? "#8C8C8C" : "#1E4D2B",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? "default" : "pointer",
            }}
          >
            Copy &amp; open {targetLabel}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "11px 18px",
              backgroundColor: "transparent",
              color: "#1A1A1A",
              border: "1px solid #E8E5E0",
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
        <p style={{ marginTop: 10, fontSize: 11, color: "#8C8C8C", lineHeight: 1.4 }}>
          {targetLabel} doesn't always accept pre-filled text on mobile — we copy your post
          to the clipboard first so you can paste it into the composer.
        </p>
        <input
          type="hidden"
          value={fullText}
          readOnly
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

// ─── Main button ─────────────────────────────────────────────────────────

export function ShareButton({
  articleUrl,
  headline,
  sourceName,
  campaign,
  compact = false,
  contentType = "story",
  episodeId,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const [overlayTarget, setOverlayTarget] = useState<ShareTarget | null>(null);
  const [blurb, setBlurb] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const prefetchRef = useRef<{ target: ShareTarget | null; started: boolean }>({
    target: null,
    started: false,
  });

  const draftOpts = useMemo(
    () => ({ articleUrl, contentType, episodeId }),
    [articleUrl, contentType, episodeId]
  );

  // Kick off a draft fetch when the dropdown opens, so by the time the user
  // clicks LinkedIn/Twitter the blurb is (usually) already in hand.
  useEffect(() => {
    if (!open) {
      prefetchRef.current = { target: null, started: false };
      return;
    }
    if (prefetchRef.current.started) return;
    prefetchRef.current = { target: "linkedin", started: true };
    let cancelled = false;
    setLoading(true);
    fetchDraft("linkedin", draftOpts).then((result) => {
      if (cancelled) return;
      if (result) {
        setBlurb(result.blurb);
        setShareUrl(result.share_url);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, draftOpts]);

  const openOverlayFor = useCallback(
    async (target: ShareTarget) => {
      setOverlayTarget(target);
      setOpen(false);

      // If we prefetched for the wrong target (e.g. user clicked Twitter but
      // we only have the linkedin draft), re-fetch.
      const needsRefetch = prefetchRef.current.target !== target;
      if (needsRefetch || !blurb || !shareUrl) {
        setLoading(true);
        const result = await fetchDraft(target, draftOpts);
        if (result) {
          setBlurb(result.blurb);
          setShareUrl(result.share_url);
        }
        setLoading(false);
      }
    },
    [blurb, shareUrl, draftOpts]
  );

  const onCopyAndOpen = useCallback(() => {
    if (!overlayTarget || loading || !blurb) return;
    const fullText = `${blurb}\n\n${shareUrl}`;
    const href = buildTargetHref(overlayTarget, blurb, shareUrl);

    // CRITICAL: copy + open must both happen synchronously within the click
    // gesture so iOS Safari honours both the clipboard write and the popup.
    // Do the copy first; the fire-and-forget promise doesn't block window.open.
    try {
      navigator.clipboard.writeText(fullText).catch(() => {
        // Fallback — older browsers.
        window.prompt("Copy this post, then paste into the composer:", fullText);
      });
    } catch {
      window.prompt("Copy this post, then paste into the composer:", fullText);
    }

    window.open(href, "_blank", "noopener,noreferrer");
    setCopied(true);
    setOverlayTarget(null);
    setTimeout(() => setCopied(false), 1400);
  }, [overlayTarget, blurb, shareUrl, loading]);

  const onEmail = useCallback(async () => {
    const url = await fetchShareUrl("email", { ...draftOpts, campaign });
    const subject = encodeURIComponent(headline ?? "From ClimatePulse");
    const body = encodeURIComponent(
      `${composeEmailBlurb(headline, sourceName)}\n\n${url}`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }, [draftOpts, campaign, headline, sourceName]);

  const onCopy = useCallback(async () => {
    const url = await fetchShareUrl("copy", { ...draftOpts, campaign });
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }, [draftOpts, campaign]);

  const trigger = compact ? (
    <button
      type="button"
      aria-label="Share"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Share2 className="h-3.5 w-3.5" />
    </button>
  ) : (
    <button
      type="button"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Share2 className="h-3.5 w-3.5" />
      Share
    </button>
  );

  return (
    <>
      <div onClick={(e) => e.stopPropagation()}>
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem
              onClick={() => openOverlayFor("linkedin")}
              className="gap-2 text-sm"
            >
              <LinkedInIcon className="h-4 w-4 text-muted-foreground" />
              LinkedIn
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => openOverlayFor("twitter")}
              className="gap-2 text-sm"
            >
              <XIcon className="h-4 w-4 text-muted-foreground" />
              Twitter / X
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEmail} className="gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              Email
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCopy} className="gap-2 text-sm">
              {copied ? (
                <Check className="h-4 w-4 text-accent-emerald" />
              ) : (
                <LinkIcon className="h-4 w-4 text-muted-foreground" />
              )}
              {copied ? "Copied!" : "Copy link"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {overlayTarget && (
        <BlurbOverlay
          target={overlayTarget}
          loading={loading}
          blurb={loading ? "" : blurb}
          setBlurb={setBlurb}
          shareUrl={shareUrl}
          onCopyAndOpen={onCopyAndOpen}
          onClose={() => setOverlayTarget(null)}
        />
      )}
    </>
  );
}
