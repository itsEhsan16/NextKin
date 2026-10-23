import { create } from 'zustand';

/**
 * The accuracy confirmation (V2 §15 risk 2): before a version's first export the user confirms it
 * is accurate. Any export path asks through `ask()` and waits for the answer; one host at the root
 * shows the sheet, above whatever screen the export started on. No artboard draws it, so it is
 * built from the spec with the existing confirm sheet (rule 7).
 */
type AccuracyState = {
  open: boolean;
  resolve: ((confirmed: boolean) => void) | null;
  ask: () => Promise<boolean>;
  answer: (confirmed: boolean) => void;
};

export const useAccuracyStore = create<AccuracyState>((set, get) => ({
  open: false,
  resolve: null,
  ask: () =>
    new Promise<boolean>((resolve) => {
      // A second ask while one is open settles the first as "not yet": one sheet, one answer.
      get().resolve?.(false);
      set({ open: true, resolve });
    }),
  answer: (confirmed) => {
    get().resolve?.(confirmed);
    set({ open: false, resolve: null });
  },
}));
