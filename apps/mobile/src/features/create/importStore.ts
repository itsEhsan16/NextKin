import { create } from 'zustand';

import type { ProfileDraft } from '@/data/models';

type ImportState = {
  /**
   * What parsing an upload produced (V2 §7.4). It lives here rather than in the query cache
   * because it is not a server resource: nothing has an id to fetch it back by, and nothing is
   * committed until the review screen says so. Cleared when the review ends, either way.
   */
  draft: ProfileDraft | null;
  /** The document the parse created — real and already in the library, unlike the draft. */
  resumeId: string | null;
  /** A first resume: the review leads on to picking a job, not back to the document. */
  thenPickJob: boolean;
  setImport: (payload: { draft: ProfileDraft; resumeId: string; thenPickJob?: boolean }) => void;
  clearImport: () => void;
};

/**
 * The one piece of state that has to survive a push: the upload screen parses, the review screen
 * accepts rows. Route params cannot carry a parsed profile, and a draft is not a query key.
 */
export const useImportStore = create<ImportState>((set) => ({
  draft: null,
  resumeId: null,
  thenPickJob: false,
  setImport: ({ draft, resumeId, thenPickJob = false }) => set({ draft, resumeId, thenPickJob }),
  clearImport: () => set({ draft: null, resumeId: null, thenPickJob: false }),
}));
