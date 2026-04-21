"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ExclamationTriangleIcon,
  SparklesIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";
import { COLORS, FONTS } from "@/lib/design-tokens";

type RefusalReason =
  | "thin_substrate"
  | "over_broad"
  | "over_narrow"
  | "off_topic"
  | "generation_disabled";

interface Warning {
  code: string;
  message: string;
}

interface PathItem {
  item_type: string;
  item_id: string;
  item_version?: number;
  chapter: string;
  position: number;
  completion_required: boolean;
  note?: string;
}

interface PathPlan {
  items: PathItem[];
  chapters: { label: string; position: number }[];
}

interface GenerateResponse {
  plan?: PathPlan;
  warnings?: Warning[];
  refused?: RefusalReason;
}

const REFUSAL_MESSAGES: Record<
  RefusalReason,
  { title: string; body: string; suggestion: string }
> = {
  off_topic: {
    title: "That looks off-topic",
    body: "ClimatePulse focuses on climate, energy, and sustainability. I couldn't map your question to any of the microsectors we cover.",
    suggestion: "Try something like: \"Safeguard Mechanism changes for heavy industry\" or \"Australian green hydrogen project finance\".",
  },
  thin_substrate: {
    title: "Too little material to build a path",
    body: "We don't yet have enough concept cards or briefs covering that exact intersection to assemble a sequenced reading path.",
    suggestion: "Broaden the scope slightly — e.g. drop a specific project name and ask about the technology or policy in general.",
  },
  over_broad: {
    title: "That's too broad to sequence",
    body: "The question spans so many microsectors that a single path would become a survey, not a reading experience.",
    suggestion: "Narrow it to one or two microsectors, or pick a specific lens (finance, policy, engineering).",
  },
  over_narrow: {
    title: "Too narrow — not enough items",
    body: "The substrate that matched your intent is below the minimum for a useful path.",
    suggestion: "Widen your prompt with a related microsector or a longer time horizon.",
  },
  generation_disabled: {
    title: "Path generation is paused",
    body: "The path generator is currently disabled on this deployment.",
    suggestion: "Check back later, or explore the editor-curated paths.",
  },
};

export default function GeneratePathPage() {
  const router = useRouter();
  const [freeText, setFreeText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [response, setResponse] = useState<GenerateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onGenerate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!freeText.trim()) return;
      setGenerating(true);
      setError(null);
      setResponse(null);
      try {
        const res = await fetch("/api/learn/paths/generate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ freeText }),
        });
        const data = (await res.json()) as GenerateResponse;
        setResponse(data);
      } catch (err) {
        setError(String(err));
      } finally {
        setGenerating(false);
      }
    },
    [freeText],
  );

  const onSave = useCallback(async () => {
    if (!response?.plan) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/learn/paths", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          plan: response.plan,
          freeText,
          title: deriveTitle(freeText),
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status}: ${txt}`);
      }
      const data = (await res.json()) as { slug: string; id: string };
      router.push(`/learn/paths/${data.slug}`);
    } catch (err) {
      setError(String(err));
      setSaving(false);
    }
  }, [response, freeText, router]);

  return (
    <div
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "32px 24px 64px",
        fontFamily: FONTS.sans,
        color: COLORS.ink,
      }}
    >
      <nav style={{ marginBottom: 16 }}>
        <Link
          href="/learn/paths"
          style={{
            all: "unset",
            cursor: "pointer",
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: COLORS.inkMuted,
          }}
        >
          ← All learning paths
        </Link>
      </nav>

      <header
        style={{
          borderBottom: `1px solid ${COLORS.border}`,
          paddingBottom: 20,
          marginBottom: 28,
        }}
      >
        <p
          style={{
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: COLORS.inkMuted,
            margin: 0,
          }}
        >
          <SparklesIcon
            width={12}
            height={12}
            strokeWidth={1.6}
            style={{ verticalAlign: "-2px", marginRight: 4 }}
          />
          Generate a path
        </p>
        <h1
          style={{
            fontFamily: FONTS.serif,
            fontSize: 32,
            lineHeight: 1.15,
            margin: "6px 0 10px",
            fontWeight: 500,
          }}
        >
          What do you want to learn?
        </h1>
        <p
          style={{
            color: COLORS.inkSec,
            fontSize: 15,
            lineHeight: 1.55,
            margin: 0,
            maxWidth: 600,
          }}
        >
          Describe the topic or question in your own words. We&rsquo;ll assemble a
          sequence of concept cards and briefs drawn from the ClimatePulse
          substrate.
        </p>
      </header>

      <form onSubmit={onGenerate} style={{ marginBottom: 28 }}>
        <textarea
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          placeholder="e.g. How does the Safeguard Mechanism interact with voluntary offset demand in Australian heavy industry?"
          rows={4}
          disabled={generating}
          style={{
            display: "block",
            width: "100%",
            padding: "14px 16px",
            fontSize: 15,
            fontFamily: FONTS.serif,
            lineHeight: 1.55,
            color: COLORS.ink,
            border: `1px solid ${COLORS.border}`,
            background: COLORS.surface,
            borderRadius: 2,
            resize: "vertical",
            boxSizing: "border-box",
          }}
        />
        <div
          style={{
            marginTop: 12,
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
          }}
        >
          <button
            type="submit"
            disabled={generating || !freeText.trim()}
            style={{
              all: "unset",
              cursor:
                generating || !freeText.trim() ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 16px",
              background: generating || !freeText.trim()
                ? COLORS.inkFaint
                : COLORS.forest,
              color: "#fff",
              fontSize: 13,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              borderRadius: 2,
            }}
          >
            {generating ? "Generating…" : "Generate path"}
            {!generating && (
              <ArrowRightIcon width={14} height={14} strokeWidth={1.6} />
            )}
          </button>
        </div>
      </form>

      {error && (
        <div
          role="alert"
          style={{
            padding: "12px 14px",
            border: `1px solid ${COLORS.plum}`,
            background: COLORS.plumLight,
            color: COLORS.plum,
            fontSize: 13,
            marginBottom: 20,
            borderRadius: 2,
          }}
        >
          {error}
        </div>
      )}

      {response?.refused && (
        <RefusalBanner reason={response.refused} />
      )}

      {response?.plan && (
        <PlanPreview
          plan={response.plan}
          warnings={response.warnings ?? []}
          onSave={onSave}
          saving={saving}
        />
      )}
    </div>
  );
}

function deriveTitle(freeText: string): string {
  const trimmed = freeText.trim().replace(/\s+/g, " ");
  if (trimmed.length <= 80) return trimmed;
  return trimmed.slice(0, 77) + "…";
}

function RefusalBanner({ reason }: { reason: RefusalReason }) {
  const meta = REFUSAL_MESSAGES[reason] ?? REFUSAL_MESSAGES.off_topic;
  return (
    <div
      style={{
        padding: "16px 18px",
        border: `1px solid ${COLORS.border}`,
        background: COLORS.paperDark,
        borderRadius: 2,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
          color: COLORS.ink,
        }}
      >
        <ExclamationTriangleIcon
          width={18}
          height={18}
          strokeWidth={1.6}
          style={{ color: COLORS.plum }}
        />
        <h2
          style={{
            fontFamily: FONTS.serif,
            fontSize: 18,
            margin: 0,
            fontWeight: 500,
          }}
        >
          {meta.title}
        </h2>
      </div>
      <p
        style={{
          margin: "0 0 8px",
          color: COLORS.inkSec,
          fontSize: 14,
          lineHeight: 1.55,
        }}
      >
        {meta.body}
      </p>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          color: COLORS.inkSec,
          lineHeight: 1.5,
          fontStyle: "italic",
        }}
      >
        {meta.suggestion}
      </p>
    </div>
  );
}

function PlanPreview({
  plan,
  warnings,
  onSave,
  saving,
}: {
  plan: PathPlan;
  warnings: Warning[];
  onSave: () => void;
  saving: boolean;
}) {
  // Group items by chapter (preserve order)
  const chapters: { chapter: string; items: PathItem[] }[] = [];
  const idx = new Map<string, number>();
  const sorted = [...plan.items].sort((a, b) => a.position - b.position);
  for (const it of sorted) {
    const key = it.chapter ?? "Reading order";
    if (!idx.has(key)) {
      idx.set(key, chapters.length);
      chapters.push({ chapter: key, items: [] });
    }
    chapters[idx.get(key)!].items.push(it);
  }

  return (
    <section>
      <h2
        style={{
          fontFamily: FONTS.serif,
          fontSize: 22,
          fontWeight: 500,
          margin: "0 0 8px",
        }}
      >
        Proposed path
      </h2>
      <p
        style={{
          color: COLORS.inkSec,
          fontSize: 13,
          margin: "0 0 16px",
        }}
      >
        {plan.items.length} item{plan.items.length === 1 ? "" : "s"} across{" "}
        {chapters.length} chapter{chapters.length === 1 ? "" : "s"}.
      </p>

      {warnings.length > 0 && (
        <div
          role="status"
          style={{
            padding: "12px 14px",
            border: `1px solid #E4B63A`,
            background: "#FDF5DC",
            color: "#7A5C12",
            fontSize: 13,
            lineHeight: 1.5,
            marginBottom: 20,
            borderRadius: 2,
          }}
        >
          <strong style={{ display: "block", marginBottom: 4 }}>
            Heads up
          </strong>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {warnings.map((w, i) => (
              <li key={i}>{w.message}</li>
            ))}
          </ul>
        </div>
      )}

      <ol
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
        }}
      >
        {chapters.map((ch) => (
          <li key={ch.chapter} style={{ marginBottom: 20 }}>
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: COLORS.inkMuted,
                marginBottom: 8,
                paddingBottom: 4,
                borderBottom: `1px solid ${COLORS.borderLight}`,
              }}
            >
              {ch.chapter}
            </div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {ch.items.map((it) => (
                <li
                  key={`${it.item_type}:${it.item_id}`}
                  style={{
                    padding: "8px 0",
                    borderBottom: `1px solid ${COLORS.borderLight}`,
                    display: "flex",
                    gap: 12,
                    alignItems: "baseline",
                  }}
                >
                  <span
                    style={{
                      color: COLORS.inkMuted,
                      fontSize: 12,
                      minWidth: 28,
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {String(it.position + 1).padStart(2, "0")}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontFamily: FONTS.serif,
                        fontSize: 15,
                        color: COLORS.ink,
                      }}
                    >
                      {it.item_type.replace(/_/g, " ")}
                    </div>
                    {it.note && (
                      <p
                        style={{
                          margin: "4px 0 0",
                          fontSize: 12,
                          color: COLORS.inkSec,
                        }}
                      >
                        {it.note}
                      </p>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: COLORS.inkMuted,
                    }}
                  >
                    {it.item_type}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      <div
        style={{
          marginTop: 24,
          display: "flex",
          justifyContent: "flex-end",
          gap: 10,
        }}
      >
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          style={{
            all: "unset",
            cursor: saving ? "not-allowed" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 16px",
            background: saving ? COLORS.inkFaint : COLORS.forest,
            color: "#fff",
            fontSize: 13,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            borderRadius: 2,
          }}
        >
          {saving ? "Saving…" : "Save path"}
          {!saving && <ArrowRightIcon width={14} height={14} strokeWidth={1.6} />}
        </button>
      </div>
    </section>
  );
}
