'use client';

import type { ResumeDocument } from '@nextkin/shared/models';
import { useCallback, useReducer } from 'react';

/**
 * The editor's working copy with undo and redo (toreview §124). Typing into one field is one step:
 * changes with the same `key` inside a second of each other replace the step rather than add one,
 * so undo takes back a word or a sentence, not a letter.
 */

const LIMIT = 100;
const MERGE_MS = 1000;

type State = {
  past: ResumeDocument[];
  present: ResumeDocument | null;
  future: ResumeDocument[];
  lastKey: string | null;
  lastAt: number;
};

type Action =
  | { type: 'load'; doc: ResumeDocument }
  | {
      type: 'change';
      recipe: (doc: ResumeDocument) => ResumeDocument;
      key: string | null;
      at: number;
    }
  | { type: 'undo' }
  | { type: 'redo' }
  /** The server's copy after a save: same content, new version and revision. Not a step. */
  | { type: 'stamp'; versionId: string; revision: string; pendingReview?: boolean };

const initial: State = { past: [], present: null, future: [], lastKey: null, lastAt: 0 };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'load':
      return { ...initial, present: action.doc };
    case 'change': {
      if (!state.present) return state;
      const next = action.recipe(state.present);
      if (next === state.present) return state;
      const merge =
        action.key !== null && action.key === state.lastKey && action.at - state.lastAt < MERGE_MS;
      return {
        past: merge ? state.past : [...state.past, state.present].slice(-LIMIT),
        present: next,
        future: [],
        lastKey: action.key,
        lastAt: action.at,
      };
    }
    case 'undo': {
      const previous = state.past.at(-1);
      if (!previous || !state.present) return state;
      return {
        past: state.past.slice(0, -1),
        present: carry(previous, state.present),
        future: [state.present, ...state.future],
        lastKey: null,
        lastAt: 0,
      };
    }
    case 'redo': {
      const [next, ...rest] = state.future;
      if (!next || !state.present) return state;
      return {
        past: [...state.past, state.present],
        present: carry(next, state.present),
        future: rest,
        lastKey: null,
        lastAt: 0,
      };
    }
    case 'stamp': {
      if (!state.present) return state;
      const stamp = (d: ResumeDocument): ResumeDocument => ({
        ...d,
        versionId: action.versionId,
        revision: action.revision,
        ...(action.pendingReview ? { pendingReview: true } : { pendingReview: undefined }),
      });
      return {
        ...state,
        present: stamp(state.present),
        past: state.past.map(stamp),
        future: state.future.map(stamp),
      };
    }
  }
}

/** A step taken back keeps the newest version stamp, so the next save names the right revision. */
const carry = (doc: ResumeDocument, from: ResumeDocument): ResumeDocument => ({
  ...doc,
  versionId: from.versionId,
  revision: from.revision,
});

export function useEditorHistory() {
  const [state, dispatch] = useReducer(reducer, initial);
  const load = useCallback((doc: ResumeDocument) => dispatch({ type: 'load', doc }), []);
  const change = useCallback(
    (recipe: (doc: ResumeDocument) => ResumeDocument, key: string | null = null) =>
      dispatch({ type: 'change', recipe, key, at: Date.now() }),
    [],
  );
  const undo = useCallback(() => dispatch({ type: 'undo' }), []);
  const redo = useCallback(() => dispatch({ type: 'redo' }), []);
  const stamp = useCallback(
    (versionId: string, revision: string, pendingReview?: boolean) =>
      dispatch({ type: 'stamp', versionId, revision, ...(pendingReview ? { pendingReview } : {}) }),
    [],
  );
  return {
    doc: state.present,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    load,
    change,
    undo,
    redo,
    stamp,
  };
}
