"use client";

import { useCallback, useEffect, useState } from "react";
import { COLORS, FONTS } from "@/lib/design-tokens";
import { SectorTag } from "./SectorTag";
import { SavedClipping, type SavedClippingItem } from "./SavedClipping";

const PAGE_SIZE = 60;

const DOMAIN_OPTIONS = [
  "energy-generation",
  "energy-storage",
  "energy-grid",
  "carbon-emissions",
  "transport",
  "industry",
  "agriculture",
  "built-environment",
  "critical-minerals",
  "finance",
  "policy",
  "workforce-adaptation",
];

interface SavedResponse {
  items: SavedClippingItem[];
  cursor: string | null;
}

/**
 * The user's saved-articles archive. Profile-page drop-in. Renders as a
 * dense clippings board (CSS grid, no cell containers). Search by note or
 * title, filter by sector tag, infinite-scroll paginated by saved_at.
 */
export function SavedBoard() {
  const [items, setItems] = useState<SavedClippingItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [sectors, setSectors] = useState<string[]>([]);

  // Debounce search input — query DB no more than once per 300ms.
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const buildUrl = useCallback(
    (cur: string | null) => {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      if (sectors.length > 0) params.set("sectors", sectors.join(","));
      if (searchDebounced) params.set("q", searchDebounced);
      if (cur) params.set("cursor", cur);
      return `/api/newsroom/saved?${params.toString()}`;
    },
    [sectors, searchDebounced]
  );

  const load = useCallback(
    async (mode: "reset" | "append") => {
      if (isLoading) return;
      setIsLoading(true);
      try {
        const cur = mode === "append" ? cursor : null;
        const res = await fetch(buildUrl(cur));
        if (!res.ok) {
          if (res.status === 401) {
            setItems([]);
            setHasMore(false);
            return;
          }
          throw new Error(String(res.status));
        }
        const data = (await res.json()) as SavedResponse;
        setItems((prev) => (mode === "append" ? [...prev, ...data.items] : data.items));
        setCursor(data.cursor);
        setHasMore(data.cursor !== null);
      } catch (err) {
        console.warn("[SavedBoard] load failed:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [buildUrl, cursor, isLoading]
  );

  useEffect(() => {
    void load("reset");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDebounced, sectors.join(",")]);

  const onRemove = useCallback(async (rawArticleId: string) => {
    try {
      const res = await fetch("/api/newsroom/save", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_article_id: rawArticleId }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setItems((prev) => prev.filter((i) => i.raw_article_id !== rawArticleId));
    } catch (err) {
      console.warn("[SavedBoard] remove failed:", err);
    }
  }, []);

  const sectorSet = new Set(sectors);
  const toggleSector = (s: string) => {
    const next = new Set(sectorSet);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    setSectors(Array.from(next));
  };

  return (
    <section
      style={{
        marginTop: 24,
        padding: "0 4px",
      }}
    >
      <header style={{ marginBottom: 12 }}>
        <h2
          style={{
            margin: 0,
            fontFamily: FONTS.serif,
            fontSize: 20,
            fontWeight: 500,
            color: COLORS.ink,
          }}
        >
          Saved articles
        </h2>
        <p
          style={{
            margin: "2px 0 0 0",
            fontFamily: FONTS.sans,
            fontSize: 11,
            color: COLORS.inkMuted,
          }}
        >
          Your personal archive — items saved from the Newsroom appear here.
        </p>
      </header>

      {/* Typographic search bar — no container, hairline underline only */}
      <div style={{ marginBottom: 10 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search saved articles…"
          style={{
            width: "100%",
            background: "transparent",
            border: "none",
            borderBottom: `1px solid ${COLORS.border}`,
            padding: "6px 0",
            fontFamily: FONTS.sans,
            fontSize: 14,
            color: COLORS.ink,
            outline: "none",
          }}
        />
      </div>

      {/* Sector filter row */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          rowGap: 6,
          marginBottom: 14,
        }}
      >
        {DOMAIN_OPTIONS.map((d) => (
          <SectorTag
            key={d}
            domain={d}
            active={sectorSet.has(d)}
            onClick={() => toggleSector(d)}
          />
        ))}
        {sectors.length > 0 && (
          <button
            onClick={() => setSectors([])}
            style={{
              background: "transparent",
              border: "none",
              fontFamily: FONTS.sans,
              fontSize: 10,
              letterSpacing: 0.4,
              color: COLORS.inkFaint,
              textTransform: "uppercase",
              cursor: "pointer",
              padding: 0,
            }}
          >
            CLEAR
          </button>
        )}
      </div>

      {items.length === 0 && !isLoading ? (
        <div
          style={{
            padding: "32px 0",
            color: COLORS.inkMuted,
            fontFamily: FONTS.sans,
            fontSize: 13,
            textAlign: "center",
          }}
        >
          {searchDebounced || sectors.length > 0
            ? "No saved articles match these filters."
            : "Nothing saved yet. Tap the bookmark icon on a Newsroom item to add one here."}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 6,
            rowGap: 12,
          }}
        >
          {items.map((it) => (
            <SavedClipping key={it.id} item={it} onRemove={onRemove} />
          ))}
        </div>
      )}

      {hasMore && items.length > 0 && (
        <div style={{ textAlign: "center", padding: "16px 0" }}>
          <button
            onClick={() => load("append")}
            disabled={isLoading}
            style={{
              background: "transparent",
              border: "none",
              fontFamily: FONTS.sans,
              fontSize: 11,
              letterSpacing: 0.4,
              color: COLORS.inkSec,
              textTransform: "uppercase",
              cursor: isLoading ? "wait" : "pointer",
              padding: "6px 12px",
              borderBottom: `1px solid ${COLORS.border}`,
            }}
          >
            {isLoading ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </section>
  );
}
