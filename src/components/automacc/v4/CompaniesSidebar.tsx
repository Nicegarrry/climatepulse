"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { COLORS, FONTS } from "@/lib/design-tokens";
import type { MaccWorkspace } from "@/lib/automacc/v4-store";
import type { MaccSession } from "@/lib/automacc/v4-types";

interface Props {
  workspace: MaccWorkspace;
}

function totalTco2y(session: MaccSession): number {
  let sum = 0;
  for (const s of session.sources) sum += s.tco2y ?? 0;
  return sum;
}

function formatTco2y(value: number): string {
  if (value <= 0) return "0 tCO2/y";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M tCO2/y`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k tCO2/y`;
  return `${Math.round(value)} tCO2/y`;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.floor((Date.now() - then) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return "older";
}

interface CardProps {
  session: MaccSession;
  isActive: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  canDelete: boolean;
}

function CompanyCard({ session, isActive, onSelect, onRename, onDelete, canDelete }: CardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(session.name);
  const [hover, setHover] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(session.name);
  }, [session.name, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const sourceCount = session.sources.length;
  const tco2yLabel = formatTco2y(totalTco2y(session));
  const updated = relativeTime(session.updatedAt);

  const cardStyle: CSSProperties = {
    position: "relative",
    padding: "10px 12px",
    border: isActive ? `1.5px solid ${COLORS.forest}` : `1px solid ${COLORS.border}`,
    background: isActive ? COLORS.sageTint : "#fff",
    borderRadius: 6,
    cursor: "pointer",
    fontFamily: FONTS.sans,
    transition: "border-color 120ms ease",
  };

  function commit() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== session.name) onRename(trimmed);
    else setDraft(session.name);
    setEditing(false);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => { if (!editing) onSelect(); }}
      onKeyDown={(e) => {
        if (!editing && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onSelect();
        }
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={cardStyle}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); commit(); }
              else if (e.key === "Escape") { setDraft(session.name); setEditing(false); }
              e.stopPropagation();
            }}
            onClick={(e) => e.stopPropagation()}
            style={{
              flex: 1, minWidth: 0,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 4, padding: "2px 6px",
              fontSize: 13, fontWeight: 600, color: COLORS.ink,
              fontFamily: FONTS.sans, outline: "none", background: "#fff",
            }}
          />
        ) : (
          <span
            onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
            title="Double-click to rename"
            style={{
              flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: COLORS.ink,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}
          >
            {session.name || "Untitled company"}
          </span>
        )}
        {canDelete && hover && !editing && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            aria-label={`Delete ${session.name}`}
            style={{
              border: "none", background: "transparent", padding: 2, cursor: "pointer",
              display: "inline-flex", alignItems: "center", color: COLORS.inkMuted, borderRadius: 3,
            }}
          >
            <XMarkIcon width={14} height={14} />
          </button>
        )}
      </div>
      <div style={{ marginTop: 4, fontSize: 11, color: COLORS.inkMuted, display: "flex", gap: 6, flexWrap: "wrap" }}>
        <span>{sourceCount} source{sourceCount === 1 ? "" : "s"}</span>
        <span style={{ color: COLORS.inkFaint }}>·</span>
        <span>{tco2yLabel}</span>
      </div>
      {updated && (
        <div style={{ marginTop: 2, fontSize: 10, color: COLORS.inkFaint, letterSpacing: "0.01em" }}>
          {updated}
        </div>
      )}
    </div>
  );
}

export function CompaniesSidebar({ workspace }: Props) {
  const { sessions, activeId } = workspace;
  const canDelete = sessions.length > 1;

  return (
    <aside
      style={{
        background: COLORS.bg,
        borderRight: `1px solid ${COLORS.border}`,
        padding: "20px 14px",
        fontFamily: FONTS.sans,
        minHeight: "100vh",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, paddingLeft: 2 }}>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: COLORS.inkSec }}>
          Companies
        </span>
        <button
          type="button"
          onClick={() => workspace.createCompany()}
          style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "4px 10px", background: COLORS.forest, color: "#fff",
            border: "none", borderRadius: 999, fontSize: 11, fontWeight: 600,
            cursor: "pointer", fontFamily: FONTS.sans, letterSpacing: "0.01em",
          }}
        >
          <PlusIcon width={12} height={12} />
          New
        </button>
      </div>
      {sessions.length === 0 ? (
        <p style={{ fontSize: 12, color: COLORS.inkMuted, padding: "12px 4px", margin: 0 }}>
          No companies yet — click “+ New” to start.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {sessions.map((s) => (
            <CompanyCard
              key={s.id}
              session={s}
              isActive={s.id === activeId}
              onSelect={() => workspace.switchTo(s.id)}
              onRename={(name) => workspace.renameCompany(s.id, name)}
              onDelete={() => workspace.deleteCompany(s.id)}
              canDelete={canDelete}
            />
          ))}
        </div>
      )}
    </aside>
  );
}
