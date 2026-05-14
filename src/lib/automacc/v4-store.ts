"use client";

import { useEffect, useReducer, useRef, useCallback } from "react";
import { EMPTY_SESSION, type MaccSession, type CompanyMeta, type SourceEntry, type LeverChoice } from "./v4-types";

const LS_KEY = "automacc.v4.session";
const SAVE_DEBOUNCE_MS = 800;

type Action =
  | { type: "hydrate"; session: MaccSession }
  | { type: "setMeta"; meta: Partial<CompanyMeta> }
  | { type: "setStep"; step: 1 | 2 | 3 }
  | { type: "setAggressiveness"; pct: number }
  | { type: "addSource"; source: SourceEntry }
  | { type: "updateSource"; id: string; patch: Partial<SourceEntry> }
  | { type: "removeSource"; id: string }
  | { type: "setSources"; sources: SourceEntry[] }
  | { type: "setLever"; sourceId: string; patch: Partial<LeverChoice> }
  | { type: "setLevers"; levers: LeverChoice[] }
  | { type: "reset" };

function reducer(state: MaccSession, action: Action): MaccSession {
  const stamp = () => new Date().toISOString();
  switch (action.type) {
    case "hydrate":
      return action.session;
    case "setMeta":
      return { ...state, meta: { ...state.meta, ...action.meta }, updatedAt: stamp() };
    case "setStep":
      return { ...state, step: action.step, updatedAt: stamp() };
    case "setAggressiveness":
      return { ...state, aggressivenessPct: action.pct, updatedAt: stamp() };
    case "addSource":
      return { ...state, sources: [...state.sources, action.source], updatedAt: stamp() };
    case "updateSource":
      return {
        ...state,
        sources: state.sources.map((s) => (s.id === action.id ? { ...s, ...action.patch } : s)),
        updatedAt: stamp(),
      };
    case "removeSource":
      return {
        ...state,
        sources: state.sources.filter((s) => s.id !== action.id),
        levers: state.levers.filter((l) => l.sourceId !== action.id),
        updatedAt: stamp(),
      };
    case "setSources":
      return { ...state, sources: action.sources, updatedAt: stamp() };
    case "setLever": {
      const exists = state.levers.find((l) => l.sourceId === action.sourceId);
      const nextLevers = exists
        ? state.levers.map((l) => (l.sourceId === action.sourceId ? { ...l, ...action.patch } : l))
        : [...state.levers, {
            sourceId: action.sourceId,
            approach: null,
            description: "",
            capexAud: null,
            abatementPct: 0,
            refinedCapexAud: null,
            lifetimeOpexDeltaAudAnnual: null,
            abatementTco2yFinal: null,
            npvAud: null,
            costPerTco2: null,
            libraryLeverId: null,
            geminiRationale: null,
            ...action.patch,
          }];
      return { ...state, levers: nextLevers, updatedAt: stamp() };
    }
    case "setLevers":
      return { ...state, levers: action.levers, updatedAt: stamp() };
    case "reset":
      return { ...EMPTY_SESSION, updatedAt: stamp() };
  }
}

function loadLocal(): MaccSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MaccSession;
    if (parsed.version !== 4) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveLocal(session: MaccSession) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(session));
  } catch {
    // quota exceeded — non-fatal
  }
}

export interface MaccStore {
  session: MaccSession;
  setMeta: (m: Partial<CompanyMeta>) => void;
  setStep: (s: 1 | 2 | 3) => void;
  setAggressiveness: (pct: number) => void;
  addSource: (s: SourceEntry) => void;
  updateSource: (id: string, patch: Partial<SourceEntry>) => void;
  removeSource: (id: string) => void;
  setSources: (sources: SourceEntry[]) => void;
  setLever: (sourceId: string, patch: Partial<LeverChoice>) => void;
  setLevers: (levers: LeverChoice[]) => void;
  reset: () => void;
  saving: boolean;
  hydrated: boolean;
}

// Single source of truth for AutoMACC v4 client state.
// - On mount: hydrate from localStorage, then attempt GET /api/automacc/session
//   and use whichever is newer (server wins on tie).
// - On every state change: write localStorage immediately + debounced PUT to server.
export function useMaccStore(userId: string | null): MaccStore {
  const [session, dispatch] = useReducer(reducer, EMPTY_SESSION);
  const hydratedRef = useRef(false);
  const savingRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedAtRef = useRef<string>("");

  // Hydrate on mount
  useEffect(() => {
    if (hydratedRef.current) return;
    const local = loadLocal();

    let cancelled = false;
    (async () => {
      let server: MaccSession | null = null;
      if (userId) {
        try {
          const res = await fetch("/api/automacc/session", { cache: "no-store" });
          if (res.ok) {
            const json = (await res.json()) as { session?: MaccSession };
            if (json.session?.version === 4) server = json.session;
          }
        } catch {
          // offline — fall through to local
        }
      }
      if (cancelled) return;

      const winner =
        server && local
          ? new Date(server.updatedAt).getTime() >= new Date(local.updatedAt).getTime()
            ? server
            : local
          : (server ?? local);
      if (winner) {
        dispatch({ type: "hydrate", session: winner });
        lastSavedAtRef.current = winner.updatedAt;
      }
      hydratedRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Persist on change
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (session.updatedAt === lastSavedAtRef.current) return;
    saveLocal(session);
    if (!userId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      savingRef.current = true;
      try {
        await fetch("/api/automacc/session", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ session }),
        });
        lastSavedAtRef.current = session.updatedAt;
      } catch {
        // surface in UI later — local copy already saved
      } finally {
        savingRef.current = false;
      }
    }, SAVE_DEBOUNCE_MS);
  }, [session, userId]);

  return {
    session,
    setMeta: useCallback((m: Partial<CompanyMeta>) => dispatch({ type: "setMeta", meta: m }), []),
    setStep: useCallback((s: 1 | 2 | 3) => dispatch({ type: "setStep", step: s }), []),
    setAggressiveness: useCallback(
      (pct: number) => dispatch({ type: "setAggressiveness", pct }),
      [],
    ),
    addSource: useCallback((s: SourceEntry) => dispatch({ type: "addSource", source: s }), []),
    updateSource: useCallback(
      (id: string, patch: Partial<SourceEntry>) => dispatch({ type: "updateSource", id, patch }),
      [],
    ),
    removeSource: useCallback((id: string) => dispatch({ type: "removeSource", id }), []),
    setSources: useCallback(
      (sources: SourceEntry[]) => dispatch({ type: "setSources", sources }),
      [],
    ),
    setLever: useCallback(
      (sourceId: string, patch: Partial<LeverChoice>) => dispatch({ type: "setLever", sourceId, patch }),
      [],
    ),
    setLevers: useCallback(
      (levers: LeverChoice[]) => dispatch({ type: "setLevers", levers }),
      [],
    ),
    reset: useCallback(() => dispatch({ type: "reset" }), []),
    saving: savingRef.current,
    hydrated: hydratedRef.current,
  };
}

export function newSourceId(): string {
  return `src_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
