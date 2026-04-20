"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COLORS, FONTS } from "@/lib/design-tokens";

type Action = "approve" | "reject" | "promote";

export function CandidateActions({
  id,
  actions,
}: {
  id: string;
  actions: Action[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Action | null>(null);

  async function run(action: Action) {
    if (busy) return;
    if (action === "reject") {
      const reason = prompt("Rejection reason (stored as review note):");
      if (reason === null) return;
      setBusy(action);
      const res = await fetch(`/api/teaching/candidates/${id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      await handleResponse(res);
      return;
    }
    setBusy(action);
    const res = await fetch(`/api/teaching/candidates/${id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    await handleResponse(res);
  }

  async function handleResponse(res: Response) {
    if (!res.ok) {
      const data = (await res.json().catch(() => ({ error: "unknown" }))) as {
        error?: string;
      };
      alert(`Failed: ${data.error ?? res.status}`);
    } else {
      router.refresh();
    }
    setBusy(null);
  }

  return (
    <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
      {actions.includes("approve") && (
        <Btn onClick={() => run("approve")} disabled={busy !== null} tone="default">
          {busy === "approve" ? "…" : "Approve"}
        </Btn>
      )}
      {actions.includes("promote") && (
        <Btn onClick={() => run("promote")} disabled={busy !== null} tone="forest">
          {busy === "promote" ? "…" : "Promote"}
        </Btn>
      )}
      {actions.includes("reject") && (
        <Btn onClick={() => run("reject")} disabled={busy !== null} tone="plum">
          {busy === "reject" ? "…" : "Reject"}
        </Btn>
      )}
    </div>
  );
}

function Btn({
  onClick,
  disabled,
  children,
  tone,
}: {
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
  tone: "default" | "forest" | "plum";
}) {
  const border =
    tone === "forest" ? COLORS.forest : tone === "plum" ? COLORS.plum : COLORS.border;
  const color =
    tone === "forest" ? COLORS.forest : tone === "plum" ? COLORS.plum : COLORS.inkSec;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        fontFamily: FONTS.sans,
        fontSize: 10,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        padding: "4px 8px",
        border: `1px solid ${border}`,
        background: COLORS.surface,
        color,
        cursor: disabled ? "wait" : "pointer",
      }}
    >
      {children}
    </button>
  );
}
