"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { COLORS } from "@/lib/design-tokens";

interface Props {
  slug: string;
  itemId: string;
  initialCompleted: boolean;
}

export function MarkCompleteToggle({ slug, itemId, initialCompleted }: Props) {
  const [completed, setCompleted] = useState<boolean>(initialCompleted);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      inFlightRef.current?.abort();
    },
    [],
  );

  const persist = useCallback(
    async (next: boolean) => {
      inFlightRef.current?.abort();
      const ctrl = new AbortController();
      inFlightRef.current = ctrl;
      setPending(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/learn/paths/${encodeURIComponent(slug)}/progress`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ item_id: itemId, completed: next }),
            signal: ctrl.signal,
          },
        );
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
      } catch (e) {
        if ((e as { name?: string })?.name === "AbortError") return;
        // Revert optimistic update
        setCompleted((c) => !c);
        setError(String(e));
      } finally {
        if (inFlightRef.current === ctrl) setPending(false);
      }
    },
    [slug, itemId],
  );

  const onToggle = useCallback(() => {
    const next = !completed;
    setCompleted(next); // optimistic
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void persist(next);
    }, 250);
  }, [completed, persist]);

  const label = completed ? "Completed" : "Mark complete";

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={completed}
      aria-label={label}
      title={error ? `Failed: ${error}` : label}
      style={{
        all: "unset",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        fontSize: 11,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        border: `1px solid ${completed ? COLORS.sage : COLORS.border}`,
        background: completed ? COLORS.sageTint : COLORS.surface,
        color: completed ? COLORS.forest : COLORS.inkSec,
        borderRadius: 2,
        opacity: pending ? 0.6 : 1,
        transition: "all 150ms ease",
      }}
    >
      <CheckCircleIcon
        width={14}
        height={14}
        strokeWidth={1.6}
        aria-hidden="true"
      />
      {label}
    </button>
  );
}
