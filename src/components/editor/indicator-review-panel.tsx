"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUpRight, Check, X } from "lucide-react";
import { COLORS } from "@/lib/design-tokens";

interface ReviewItem {
  id: string;
  indicator_id: string | null;
  indicator_slug: string | null;
  indicator_name: string | null;
  indicator_unit: string | null;
  indicator_geography: string | null;
  proposed_indicator_slug: string | null;
  proposed_value: number | null;
  proposed_unit: string | null;
  proposed_geography: string | null;
  source_article_id: string | null;
  source_url: string | null;
  evidence_quote: string;
  detector_confidence: number;
  detector_reason: string | null;
  status: string;
  created_at: string;
  article_title: string | null;
  article_source: string | null;
}

function formatValue(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return "—";
  if (Math.abs(v) >= 1000) return v.toLocaleString("en-AU", { maximumFractionDigits: 0 });
  if (Math.abs(v) >= 10) return v.toFixed(1);
  return v.toFixed(2);
}

export function IndicatorReviewPanel() {
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<Record<string, boolean>>({});

  const load = useCallback(() => {
    setError(null);
    fetch("/api/indicators/review?status=pending_review")
      .then((r) => r.json())
      .then((json) => {
        if (json.error) setError(json.error);
        else setItems(json.items ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(id: string, action: "approve" | "reject", notes?: string) {
    setActing((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await fetch("/api/indicators/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, notes }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Action failed");
      } else {
        setItems((prev) => (prev ?? []).filter((it) => it.id !== id));
      }
    } finally {
      setActing((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs">
        <p className="font-medium text-destructive">Couldn’t load review queue</p>
        <p className="mt-1 text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!items) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        No pending indicator hints. The detector queues here when a hit lands at confidence
        0.6–0.85 or unit/geography needs human judgment.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          <strong className="text-foreground">{items.length}</strong> pending hint
          {items.length === 1 ? "" : "s"}
        </span>
        <button onClick={load} className="hover:underline">
          Refresh
        </button>
      </header>

      {items.map((it) => {
        const isNovel = !it.indicator_id;
        const targetName = it.indicator_name ?? it.proposed_indicator_slug ?? "(unknown)";
        const targetUnit = it.indicator_unit ?? it.proposed_unit ?? "";
        const isDisabled =
          acting[it.id] || isNovel || it.proposed_value === null;

        return (
          <div
            key={it.id}
            style={{
              border: `1px solid ${COLORS.border}`,
              borderRadius: 6,
              padding: 12,
              background: COLORS.surface,
            }}
            className="flex flex-col gap-2"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{targetName}</span>
                  {isNovel && (
                    <Badge variant="outline" className="text-[10px]">
                      novel slug
                    </Badge>
                  )}
                  <Badge variant="secondary" className="text-[10px] tabular-nums">
                    confidence {it.detector_confidence.toFixed(2)}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground tabular-nums">
                  Proposed: <span className="font-mono">{formatValue(it.proposed_value)}</span>{" "}
                  {it.proposed_unit ?? targetUnit}{" "}
                  {it.proposed_geography ? `· ${it.proposed_geography}` : ""}
                  {!isNovel && targetUnit && it.proposed_unit && it.proposed_unit !== targetUnit && (
                    <span className="text-amber-700"> (catalogue unit: {targetUnit})</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isDisabled}
                  onClick={() => act(it.id, "approve")}
                  title={
                    isNovel
                      ? "Create the indicator in the catalogue before approving"
                      : it.proposed_value === null
                        ? "No numeric value to promote"
                        : "Approve and write to indicator_values"
                  }
                >
                  <Check className="h-3.5 w-3.5 mr-1" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!!acting[it.id]}
                  onClick={() => act(it.id, "reject")}
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Reject
                </Button>
              </div>
            </div>

            <blockquote className="border-l-2 pl-2 text-xs italic text-muted-foreground">
              “{it.evidence_quote}”
            </blockquote>

            <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
              {it.article_title && (
                <span className="truncate max-w-[60%]">{it.article_title}</span>
              )}
              {it.article_source && <span>· {it.article_source}</span>}
              {it.source_url && (
                <a
                  href={it.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 hover:text-foreground"
                >
                  open <ArrowUpRight className="h-3 w-3" />
                </a>
              )}
              {it.detector_reason && <span>· {it.detector_reason}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
