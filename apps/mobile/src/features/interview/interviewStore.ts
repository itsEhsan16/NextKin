import { create } from 'zustand';

import type { InterviewPracticeFilter, InterviewSet } from '@/data/models';

import { snapshotMarks, type MarkSnapshot } from './practiceRows';

type InterviewState = {
  /** The practice screen's filter, and the marks as they stood when it was chosen. */
  filter: InterviewPracticeFilter;
  filterSnapshot: MarkSnapshot;
  /**
   * The set the delete confirm is about — a snapshot taken on open, kept after close so the sheet
   * paints through its exit (the retention move every sheet host here makes).
   */
  deleteTarget: InterviewSet | null;
  deleteOpen: boolean;

  setFilter: (filter: InterviewPracticeFilter, set: Pick<InterviewSet, 'questions'>) => void;
  requestDelete: (set: InterviewSet) => void;
  closeDelete: () => void;
};

export const useInterviewStore = create<InterviewState>((set) => ({
  filter: 'all',
  filterSnapshot: {},
  deleteTarget: null,
  deleteOpen: false,

  // The snapshot is taken here, on the choice, and nowhere else: that is what keeps a mark made
  // mid-pass from removing the card under the reader's finger (see practiceRows.ts).
  setFilter: (filter, current) => set({ filter, filterSnapshot: snapshotMarks(current) }),
  requestDelete: (deleteTarget) => set({ deleteTarget, deleteOpen: true }),
  closeDelete: () => set({ deleteOpen: false }),
}));
