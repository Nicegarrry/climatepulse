"use client";

import { useEffect, useReducer, useRef, useCallback, useMemo } from "react";
import {
  emptySession,
  type MaccSession,
  type CompanyMeta,
  type SourceEntry,
  type LeverChoice,
} from "./v4-types";

const LS_KEY = "automacc.v4.workspace";
const SAVE_DEBOUNCE_MS = 800;

// ─── Workspace state ─────────────────────────────────────────────────────────

interface WorkspaceState {
  sessionsById: Record<string, MaccSession>;
  order: string[];                   // display order (most-recently-active first)
  activeId: string;
}

type Action =
  | { type: "hydrate"; sessions: MaccSession[]; activeId: string }
  | { type: "create"; session: MaccSession }
  | { type: "switch"; id: string }
  | { type: "delete"; id: string; fallback: MaccSession }
  | { type: "rename"; id: string; name: string }
  | { type: "resetActive"; replacement: MaccSession }
  | { type: "patchActive"; patcher: (s: MaccSession) => MaccSession };

function stampSession(s: MaccSession): MaccSession {
  return { ...s, updatedAt: new Date().toISOString() };
}

function reducer(state: WorkspaceState, action: Action): WorkspaceState {
  switch (action.type) {
    case "hydrate": {
      const sessionsById: Record<string, MaccSession> = {};
      for (const s of action.sessions) sessionsById[s.id] = s;
      return {
        sessionsById,
        order: action.sessions.map((s) => s.id),
        activeId: action.activeId,
      };
    }
    case "create":
      return {
        sessionsById: { ...state.sessionsById, [action.session.id]: action.session },
        order: [action.session.id, ...state.order.filter((id) => id !== action.session.id)],
        activeId: action.session.id,
      };
    case "switch":
      if (!state.sessionsById[action.id]) return state;
      return {
        ...state,
        order: [action.id, ...state.order.filter((id) => id !== action.id)],
        activeId: action.id,
      };
    case "delete": {
      const next = { ...state.sessionsById };
      delete next[action.id];
      const nextOrder = state.order.filter((id) => id !== action.id);
      if (nextOrder.length === 0) {
        return {
          sessionsById: { [action.fallback.id]: action.fallback },
          order: [action.fallback.id],
          activeId: action.fallback.id,
        };
      }
      return {
        sessionsById: next,
        order: nextOrder,
        activeId: action.id === state.activeId ? nextOrder[0] : state.activeId,
      };
    }
    case "rename": {
      const cur = state.sessionsById[action.id];
      if (!cur) return state;
      return {
        ...state,
        sessionsById: {
          ...state.sessionsById,
          [action.id]: stampSession({ ...cur, name: action.name }),
        },
      };
    }
    case "resetActive":
      return {
        ...state,
        sessionsById: { ...state.sessionsById, [action.replacement.id]: action.replacement },
        activeId: action.replacement.id,
      };
    case "patchActive": {
      const cur = state.sessionsById[state.activeId];
      if (!cur) return state;
      return {
        ...state,
        sessionsById: {
          ...state.sessionsById,
          [state.activeId]: stampSession(action.patcher(cur)),
        },
      };
    }
  }
}

// ─── Per-active-session edit helpers ────────────────────────────────────────

const applyMeta = (s: MaccSession, m: Partial<CompanyMeta>): MaccSession => ({
  ...s, meta: { ...s.meta, ...m },
});
const applyStep = (s: MaccSession, step: 1 | 2 | 3): MaccSession => ({ ...s, step });
const applyAggressiveness = (s: MaccSession, pct: number): MaccSession => ({
  ...s, aggressivenessPct: pct,
});
const applyAddSource = (s: MaccSession, src: SourceEntry): MaccSession => ({
  ...s, sources: [...s.sources, src],
});
const applyUpdateSource = (s: MaccSession, id: string, patch: Partial<SourceEntry>): MaccSession => ({
  ...s, sources: s.sources.map((row) => (row.id === id ? { ...row, ...patch } : row)),
});
const applyRemoveSource = (s: MaccSession, id: string): MaccSession => ({
  ...s,
  sources: s.sources.filter((row) => row.id !== id),
  levers: s.levers.filter((l) => l.sourceId !== id),
});
const applySetSources = (s: MaccSession, sources: SourceEntry[]): MaccSession => ({ ...s, sources });
function applySetLever(s: MaccSession, sourceId: string, patch: Partial<LeverChoice>): MaccSession {
  const exists = s.levers.find((l) => l.sourceId === sourceId);
  const nextLevers: LeverChoice[] = exists
    ? s.levers.map((l) => (l.sourceId === sourceId ? { ...l, ...patch } : l))
    : [
        ...s.levers,
        {
          sourceId,
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
          ...patch,
        },
      ];
  return { ...s, levers: nextLevers };
}
const applySetLevers = (s: MaccSession, levers: LeverChoice[]): MaccSession => ({ ...s, levers });

// ─── Persistence ─────────────────────────────────────────────────────────────

interface LocalWorkspace {
  version: 4;
  sessions: MaccSession[];
  activeId: string;
}

function loadLocal(): LocalWorkspace | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalWorkspace;
    if (parsed.version !== 4 || !Array.isArray(parsed.sessions)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveLocal(state: WorkspaceState) {
  if (typeof window === "undefined") return;
  try {
    const payload: LocalWorkspace = {
      version: 4,
      sessions: state.order.map((id) => state.sessionsById[id]).filter(Boolean),
      activeId: state.activeId,
    };
    window.localStorage.setItem(LS_KEY, JSON.stringify(payload));
  } catch {
    /* quota exceeded — non-fatal */
  }
}

// ─── Public interfaces ──────────────────────────────────────────────────────

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
  reset: () => void;            // resets ACTIVE session (preserves id+name)
  saving: boolean;
  hydrated: boolean;
}

export interface MaccWorkspace {
  sessions: MaccSession[];      // in display order, most-recently-active first
  activeId: string;
  active: MaccStore;
  hydrated: boolean;
  createCompany: (name?: string, seed?: Partial<MaccSession>) => string;
  switchTo: (id: string) => void;
  deleteCompany: (id: string) => void;
  renameCompany: (id: string, name: string) => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useMaccWorkspace(
  userId: string | null,
  initialSeed?: () => MaccSession[],
): MaccWorkspace {
  const initialEmpty = useMemo(() => emptySession(), []);
  const [state, dispatch] = useReducer(reducer, {
    sessionsById: { [initialEmpty.id]: initialEmpty },
    order: [initialEmpty.id],
    activeId: initialEmpty.id,
  });
  const hydratedRef = useRef(false);
  const savingRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedAtRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if (hydratedRef.current) return;
    const local = loadLocal();

    let cancelled = false;
    (async () => {
      let server: MaccSession[] | null = null;
      if (userId) {
        try {
          const res = await fetch("/api/automacc/session", { cache: "no-store" });
          if (res.ok) {
            const json = (await res.json()) as { sessions?: MaccSession[] };
            if (Array.isArray(json.sessions)) server = json.sessions;
          }
        } catch {
          /* offline */
        }
      }
      if (cancelled) return;

      // Merge local + server by id; pick newer updatedAt on collision.
      const merged = new Map<string, MaccSession>();
      for (const s of local?.sessions ?? []) {
        if (s?.id && s.version === 4) merged.set(s.id, s);
      }
      for (const s of server ?? []) {
        if (!s?.id || s.version !== 4) continue;
        const existing = merged.get(s.id);
        if (!existing || new Date(s.updatedAt) >= new Date(existing.updatedAt)) {
          merged.set(s.id, s);
        }
      }

      let sessions = Array.from(merged.values());

      // First-ever load → seed
      if (sessions.length === 0 && initialSeed) {
        sessions = initialSeed();
      }
      if (sessions.length === 0) {
        sessions = [emptySession()];
      }

      const activeId =
        local?.activeId && merged.has(local.activeId)
          ? local.activeId
          : sessions[0].id;

      dispatch({ type: "hydrate", sessions, activeId });
      for (const s of sessions) lastSavedAtRef.current[s.id] = s.updatedAt;
      hydratedRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, initialSeed]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    saveLocal(state);
    if (!userId) return;
    const dirty = state.order
      .map((id) => state.sessionsById[id])
      .filter((s): s is MaccSession => Boolean(s) && s.updatedAt !== lastSavedAtRef.current[s.id]);
    if (dirty.length === 0) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      savingRef.current = true;
      try {
        await Promise.all(
          dirty.map(async (s) => {
            const res = await fetch("/api/automacc/session", {
              method: "PUT",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ session: s }),
            });
            if (res.ok) lastSavedAtRef.current[s.id] = s.updatedAt;
          }),
        );
      } catch {
        /* local copy already saved */
      } finally {
        savingRef.current = false;
      }
    }, SAVE_DEBOUNCE_MS);
  }, [state, userId]);

  const patch = useCallback(
    (patcher: (s: MaccSession) => MaccSession) => dispatch({ type: "patchActive", patcher }),
    [],
  );

  const createCompany = useCallback((name?: string, seed?: Partial<MaccSession>): string => {
    const base = emptySession(name ?? "Untitled company");
    const session: MaccSession = { ...base, ...seed, id: base.id, version: 4 };
    dispatch({ type: "create", session });
    return session.id;
  }, []);

  const switchTo = useCallback((id: string) => dispatch({ type: "switch", id }), []);

  const deleteCompany = useCallback((id: string) => {
    const fallback = emptySession();
    dispatch({ type: "delete", id, fallback });
    if (userId) {
      void fetch(`/api/automacc/session?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    }
  }, [userId]);

  const renameCompany = useCallback(
    (id: string, name: string) => dispatch({ type: "rename", id, name }),
    [],
  );

  const active = state.sessionsById[state.activeId];

  const store: MaccStore = useMemo(
    () => ({
      session: active,
      setMeta: (m) => patch((s) => applyMeta(s, m)),
      setStep: (step) => patch((s) => applyStep(s, step)),
      setAggressiveness: (pct) => patch((s) => applyAggressiveness(s, pct)),
      addSource: (src) => patch((s) => applyAddSource(s, src)),
      updateSource: (id, p) => patch((s) => applyUpdateSource(s, id, p)),
      removeSource: (id) => patch((s) => applyRemoveSource(s, id)),
      setSources: (sources) => patch((s) => applySetSources(s, sources)),
      setLever: (sourceId, p) => patch((s) => applySetLever(s, sourceId, p)),
      setLevers: (levers) => patch((s) => applySetLevers(s, levers)),
      reset: () => {
        if (!active) return;
        const replacement = emptySession(active.name);
        replacement.id = active.id;
        dispatch({ type: "resetActive", replacement });
      },
      saving: savingRef.current,
      hydrated: hydratedRef.current,
    }),
    [active, patch],
  );

  const sessions = state.order
    .map((id) => state.sessionsById[id])
    .filter((s): s is MaccSession => Boolean(s));

  return {
    sessions,
    activeId: state.activeId,
    active: store,
    hydrated: hydratedRef.current,
    createCompany,
    switchTo,
    deleteCompany,
    renameCompany,
  };
}

// Back-compat for any leftover import; prefer useMaccWorkspace().
export function useMaccStore(userId: string | null): MaccStore {
  return useMaccWorkspace(userId).active;
}

export function newSourceId(): string {
  return `src_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
