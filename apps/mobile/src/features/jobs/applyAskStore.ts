import { create } from 'zustand';

import type { ApplicationAsk } from '@/data/models';

/**
 * "Did you apply?" (owner, 2026-10-31). Whatever raises the question (a download, a trip to the
 * employer's page, Home on the next open) puts it here, and one host at the root shows the sheet
 * above whichever screen that was.
 */
type ApplyAskState = {
  ask: ApplicationAsk | null;
  open: (ask: ApplicationAsk) => void;
  close: () => void;
};

export const useApplyAskStore = create<ApplyAskState>((set) => ({
  ask: null,
  open: (ask) => set({ ask }),
  close: () => set({ ask: null }),
}));
