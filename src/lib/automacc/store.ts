'use client';

import { useReducer, useMemo, useCallback } from 'react';
import type { Allocation, Fixture, MaccPackage, SessionContext } from './types';
import { runStage3 } from './stage3';
import { runStage4 } from './stage4';

type Snapshot = {
  allocations: Allocation[];
  label: string;
};

export type AllocationState = {
  allocations: Allocation[];
  undoStack: Snapshot[];
  redoStack: Snapshot[];
};

type Action =
  | { type: 'allocate'; leverId: string; sourceRowIds: string[]; isEnabler: boolean; label: string }
  | { type: 'deallocate'; allocationId: string; label: string }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset' };

const MAX_UNDO = 20;

function reducer(state: AllocationState, action: Action): AllocationState {
  switch (action.type) {
    case 'allocate': {
      const snap: Snapshot = { allocations: state.allocations, label: action.label };
      const next: Allocation = {
        allocationId: `a_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        leverId: action.leverId,
        sourceRowIds: action.sourceRowIds,
        allocatedAt: new Date().toISOString(),
        isEnabler: action.isEnabler,
      };
      return {
        allocations: [...state.allocations, next],
        undoStack: [...state.undoStack, snap].slice(-MAX_UNDO),
        redoStack: [],
      };
    }
    case 'deallocate': {
      const snap: Snapshot = { allocations: state.allocations, label: action.label };
      return {
        allocations: state.allocations.filter(a => a.allocationId !== action.allocationId),
        undoStack: [...state.undoStack, snap].slice(-MAX_UNDO),
        redoStack: [],
      };
    }
    case 'undo': {
      if (state.undoStack.length === 0) return state;
      const last = state.undoStack[state.undoStack.length - 1];
      const current: Snapshot = { allocations: state.allocations, label: last.label };
      return {
        allocations: last.allocations,
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, current].slice(-MAX_UNDO),
      };
    }
    case 'redo': {
      if (state.redoStack.length === 0) return state;
      const next = state.redoStack[state.redoStack.length - 1];
      const current: Snapshot = { allocations: state.allocations, label: next.label };
      return {
        allocations: next.allocations,
        undoStack: [...state.undoStack, current].slice(-MAX_UNDO),
        redoStack: state.redoStack.slice(0, -1),
      };
    }
    case 'reset':
      return { allocations: [], undoStack: [], redoStack: [] };
  }
}

export function useAllocationStore(fixture: Fixture, ctx: SessionContext) {
  const [state, dispatch] = useReducer(reducer, {
    allocations: [],
    undoStack: [],
    redoStack: [],
  });

  const maccPackage: MaccPackage = useMemo(() => {
    const stage3 = runStage3(state.allocations, fixture, ctx);
    return runStage4(stage3, fixture, ctx);
  }, [state.allocations, fixture, ctx]);

  const allocate = useCallback(
    (leverId: string, sourceRowIds: string[], isEnabler: boolean, label: string) =>
      dispatch({ type: 'allocate', leverId, sourceRowIds, isEnabler, label }),
    [],
  );
  const deallocate = useCallback(
    (allocationId: string, label: string) => dispatch({ type: 'deallocate', allocationId, label }),
    [],
  );
  const undo = useCallback(() => dispatch({ type: 'undo' }), []);
  const redo = useCallback(() => dispatch({ type: 'redo' }), []);
  const reset = useCallback(() => dispatch({ type: 'reset' }), []);

  const allocatedLeverIds = useMemo(() => new Set(state.allocations.map(a => a.leverId)), [state.allocations]);

  const mutexBlocked = useMemo(() => {
    const blocked = new Set<string>();
    for (const a of state.allocations) {
      const lever = fixture.levers.find(l => l.leverId === a.leverId);
      lever?.mutexPartners.forEach(p => blocked.add(p));
    }
    return blocked;
  }, [state.allocations, fixture]);

  return {
    state,
    maccPackage,
    allocate,
    deallocate,
    undo,
    redo,
    reset,
    allocatedLeverIds,
    mutexBlocked,
    canUndo: state.undoStack.length > 0,
    canRedo: state.redoStack.length > 0,
    lastUndoLabel: state.undoStack[state.undoStack.length - 1]?.label ?? null,
  };
}
