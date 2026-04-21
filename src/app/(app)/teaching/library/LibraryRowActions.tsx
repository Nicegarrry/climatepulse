"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COLORS, FONTS } from "@/lib/design-tokens";

export function LibraryRowActions({
  id,
  canReindex,
}: {
  id: string;
  canReindex: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"reindex" | "delete" | null>(null);

  async function reindex() {
    if (busy) return;
    setBusy("reindex");
    try {
      const res = await fetch(`/api/teaching/library/${id}?action=reindex`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "unknown" }));
        alert(`Reindex failed: ${(data as { error?: string }).error ?? res.status}`);
      } else {
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  async function hardDelete() {
    if (busy) return;
    if (!confirm("Hard delete this document? Blob, embeddings, and row are all removed.")) {
      return;
    }
    setBusy("delete");
    try {
      const res = await fetch(`/api/teaching/library/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "unknown" }));
        alert(`Delete failed: ${(data as { error?: string }).error ?? res.status}`);
      } else {
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
      {canReindex && (
        <button
          onClick={reindex}
          disabled={busy !== null}
          style={{
            fontFamily: FONTS.sans,
            fontSize: 10,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            padding: "4px 8px",
            border: `1px solid ${COLORS.border}`,
            background: COLORS.surface,
            cursor: busy ? "wait" : "pointer",
            color: COLORS.inkSec,
          }}
        >
          {busy === "reindex" ? "…" : "Reindex"}
        </button>
      )}
      <button
        onClick={hardDelete}
        disabled={busy !== null}
        style={{
          fontFamily: FONTS.sans,
          fontSize: 10,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          padding: "4px 8px",
          border: `1px solid ${COLORS.plum}`,
          background: COLORS.surface,
          color: COLORS.plum,
          cursor: busy ? "wait" : "pointer",
        }}
      >
        {busy === "delete" ? "…" : "Delete"}
      </button>
    </div>
  );
}
