import { create } from 'zustand';

import type { Resume } from '@/data/models';
import { storage } from '@/lib';

/** Grid ⇄ list presentation of the library (Figma RESUMES 01 vs 02). */
export type ResumesViewMode = 'grid' | 'list';

/** The All / Resumes / Cover Letters pills (Figma 1:1378). */
export type ResumeTypeFilter = 'all' | 'resume' | 'cover_letter';

/** The card menu swaps to an inline confirm before deleting (RESUMES 03 "Asks to confirm"). */
export type ResumeMenuStep = 'actions' | 'confirm-delete';

const VIEW_MODE_KEY = 'prefs.resumesView';

type ResumesState = {
  /** Persisted: reopening the app restores the last-picked layout. */
  viewMode: ResumesViewMode;
  typeFilter: ResumeTypeFilter;
  query: string;

  /**
   * The document the card menu is about — a snapshot taken on open, so the sheet keeps
   * rendering through its 200ms exit even when the underlying doc is deleted mid-close
   * (the same retention move as jobsStore's filter draft). Retained after close.
   */
  menuResume: Resume | null;
  menuOpen: boolean;
  menuStep: ResumeMenuStep;

  setViewMode: (mode: ResumesViewMode) => void;
  setTypeFilter: (filter: ResumeTypeFilter) => void;
  setQuery: (value: string) => void;

  openMenu: (resume: Resume) => void;
  closeMenu: () => void;
  requestDelete: () => void;
  cancelDelete: () => void;
};

export const useResumesStore = create<ResumesState>((set) => ({
  viewMode: storage.get<ResumesViewMode>(VIEW_MODE_KEY) ?? 'grid',
  typeFilter: 'all',
  query: '',

  menuResume: null,
  menuOpen: false,
  menuStep: 'actions',

  setViewMode: (viewMode) => {
    storage.set(VIEW_MODE_KEY, viewMode);
    set({ viewMode });
  },
  setTypeFilter: (typeFilter) => set({ typeFilter }),
  setQuery: (query) => set({ query }),

  // Re-seeds the step on every open, so a menu abandoned mid-confirm reopens on its actions.
  openMenu: (menuResume) => set({ menuResume, menuOpen: true, menuStep: 'actions' }),
  // The snapshot is deliberately NOT cleared: the sheet must not empty during its 200ms exit.
  closeMenu: () => set({ menuOpen: false }),
  requestDelete: () => set({ menuStep: 'confirm-delete' }),
  cancelDelete: () => set({ menuStep: 'actions' }),
}));
