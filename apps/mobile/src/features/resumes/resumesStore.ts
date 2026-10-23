import { create } from 'zustand';

import type { Resume, ResumeSort } from '@/data/models';
import { storage } from '@/lib';
import type { ToastTone } from '@/ui/Toast';

/** Grid ⇄ list presentation of the library (Figma RESUMES 01 vs 02). */
export type ResumesViewMode = 'grid' | 'list';

/** The All / Resumes / Cover Letters pills (Figma 1:1378). */
export type ResumeTypeFilter = 'all' | 'resume' | 'cover_letter';

/**
 * The card menu's three panes. Delete swaps to an inline confirm (RESUMES 03 "Asks to confirm");
 * rename swaps to a single field (V2 §7.11 — renaming is a title edit, not a screen).
 */
export type ResumeMenuStep = 'actions' | 'rename' | 'confirm-delete';

/**
 * Which mount of a shared host is showing.
 *
 * A pushed screen sits ABOVE the tabs layout in the stack, so the host mounted there would raise
 * its sheet *behind* the editor. The editor mounts its own copy, and the surface recorded when
 * the sheet is opened decides which of the two renders — one paint, one BackHandler, one scrim.
 * A finished Build run (BUILD 07) mounts a third, for its Download PDF.
 */
export type ResumeSurface = 'tabs' | 'editor' | 'run';

const VIEW_MODE_KEY = 'prefs.resumesView';

type ResumesState = {
  /** Persisted: reopening the app restores the last-picked layout. */
  viewMode: ResumesViewMode;
  typeFilter: ResumeTypeFilter;
  query: string;
  /** The library's order (RESUMES 01 "Last edited ▾"); the sheet behind it is `sortOpen`. */
  sort: ResumeSort;
  sortOpen: boolean;

  /**
   * The document the card menu is about — a snapshot taken on open, so the sheet keeps
   * rendering through its 200ms exit even when the underlying doc is deleted mid-close
   * (the same retention move as jobsStore's filter draft). Retained after close.
   */
  menuResume: Resume | null;
  menuOpen: boolean;
  menuStep: ResumeMenuStep;
  menuSurface: ResumeSurface;

  /** The same snapshot-and-retain shape for the export sheet (V2 §7.12). */
  exportResume: Resume | null;
  exportOpen: boolean;
  exportSurface: ResumeSurface;

  /** Transient confirmation ("Link copied", "Saved as PDF"). Hosted beside the export sheet. */
  toast: string | null;
  toastSurface: ResumeSurface;
  toastTone: ToastTone;

  setViewMode: (mode: ResumesViewMode) => void;
  setTypeFilter: (filter: ResumeTypeFilter) => void;
  setQuery: (value: string) => void;
  setSort: (sort: ResumeSort) => void;
  openSort: () => void;
  closeSort: () => void;

  openMenu: (resume: Resume, surface?: ResumeSurface) => void;
  closeMenu: () => void;
  requestRename: () => void;
  cancelRename: () => void;
  requestDelete: () => void;
  cancelDelete: () => void;

  openExport: (resume: Resume, surface?: ResumeSurface) => void;
  closeExport: () => void;

  /** `tone` defaults to success; a failure passes `error` so it never wears the check. */
  showToast: (message: string, surface?: ResumeSurface, tone?: ToastTone) => void;
  hideToast: () => void;
};

export const useResumesStore = create<ResumesState>((set) => ({
  viewMode: storage.get<ResumesViewMode>(VIEW_MODE_KEY) ?? 'grid',
  typeFilter: 'all',
  query: '',
  sort: 'edited',
  sortOpen: false,

  menuResume: null,
  menuOpen: false,
  menuStep: 'actions',
  menuSurface: 'tabs',

  exportResume: null,
  exportOpen: false,
  exportSurface: 'tabs',

  toast: null,
  toastSurface: 'tabs',
  toastTone: 'success',

  setViewMode: (viewMode) => {
    storage.set(VIEW_MODE_KEY, viewMode);
    set({ viewMode });
  },
  setTypeFilter: (typeFilter) => set({ typeFilter }),
  setQuery: (query) => set({ query }),
  setSort: (sort) => set({ sort }),
  openSort: () => set({ sortOpen: true }),
  closeSort: () => set({ sortOpen: false }),

  // Re-seeds the step on every open, so a menu abandoned mid-confirm reopens on its actions.
  openMenu: (menuResume, menuSurface = 'tabs') =>
    set({ menuResume, menuOpen: true, menuStep: 'actions', menuSurface }),
  // The snapshot is deliberately NOT cleared: the sheet must not empty during its 200ms exit.
  closeMenu: () => set({ menuOpen: false }),
  requestRename: () => set({ menuStep: 'rename' }),
  cancelRename: () => set({ menuStep: 'actions' }),
  requestDelete: () => set({ menuStep: 'confirm-delete' }),
  cancelDelete: () => set({ menuStep: 'actions' }),

  openExport: (exportResume, exportSurface = 'tabs') =>
    set({ exportResume, exportOpen: true, exportSurface }),
  closeExport: () => set({ exportOpen: false }),

  showToast: (toast, toastSurface = 'tabs', toastTone = 'success') =>
    set({ toast, toastSurface, toastTone }),
  hideToast: () => set({ toast: null }),
}));
