"use client";

import { useState, useCallback } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Share2, Mail, Link as LinkIcon, Check } from "lucide-react";

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

type ShareSource = "linkedin" | "twitter" | "email" | "copy";

interface Props {
  // The ORIGINAL source URL (the journalism we're linking to).
  articleUrl: string;
  // Optional headline used to pre-populate share copy.
  headline?: string;
  // Optional source-label (e.g. "AFR", "Reuters"). Used in the share blurb.
  sourceName?: string;
  // Optional campaign hint. Defaults to today's date (YYYY-MM-DD).
  campaign?: string;
  // Compact renders a tiny icon-only trigger; default is icon + "Share" label.
  compact?: boolean;
}

async function resolveShareUrl(
  articleUrl: string,
  source: ShareSource,
  campaign?: string
): Promise<string> {
  try {
    const res = await fetch("/api/share/url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ article_url: articleUrl, source, campaign }),
    });
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as { share_url?: string };
    return data.share_url ?? articleUrl;
  } catch {
    return articleUrl;
  }
}

function composeBlurb(headline?: string, sourceName?: string): string {
  const hl = headline?.trim();
  if (!hl) return "From today's ClimatePulse briefing.";
  return sourceName
    ? `From today's ClimatePulse briefing: ${hl} — ${sourceName}`
    : `From today's ClimatePulse briefing: ${hl}`;
}

export function ShareButton({
  articleUrl,
  headline,
  sourceName,
  campaign,
  compact = false,
}: Props) {
  const [copied, setCopied] = useState(false);

  const onShare = useCallback(
    async (source: ShareSource) => {
      const shareUrl = await resolveShareUrl(articleUrl, source, campaign);
      const text = composeBlurb(headline, sourceName);

      if (source === "linkedin") {
        const href = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
          shareUrl
        )}`;
        window.open(href, "_blank", "noopener,noreferrer");
        return;
      }

      if (source === "twitter") {
        const href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
          text
        )}&url=${encodeURIComponent(shareUrl)}`;
        window.open(href, "_blank", "noopener,noreferrer");
        return;
      }

      if (source === "email") {
        const subject = encodeURIComponent(headline ?? "From ClimatePulse");
        const body = encodeURIComponent(`${text}\n\n${shareUrl}`);
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
        return;
      }

      if (source === "copy") {
        try {
          await navigator.clipboard.writeText(shareUrl);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        } catch {
          window.prompt("Copy this link:", shareUrl);
        }
      }
    },
    [articleUrl, campaign, headline, sourceName]
  );

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
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => onShare("linkedin")} className="gap-2 text-sm">
            <LinkedInIcon className="h-4 w-4 text-muted-foreground" />
            LinkedIn
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onShare("twitter")} className="gap-2 text-sm">
            <XIcon className="h-4 w-4 text-muted-foreground" />
            Twitter / X
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onShare("email")} className="gap-2 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground" />
            Email
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onShare("copy")} className="gap-2 text-sm">
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
  );
}
