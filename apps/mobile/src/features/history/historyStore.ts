import { create } from 'zustand';

import type { ActivityFilter } from '@/data/models';

type HistoryState = {
  filter: ActivityFilter;
  setFilter: (filter: ActivityFilter) => void;
};

/**
 * The History feed's one piece of UI state. A store rather than screen state for the reason the
 * notifications filter is: leaving for a deep link and coming back should land on the pill you
 * left, not reset to All.
 */
export const useHistoryStore = create<HistoryState>((set) => ({
  filter: 'all',
  setFilter: (filter) => set({ filter }),
}));
