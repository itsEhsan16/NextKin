import { create } from 'zustand';

type BuildSourceState = {
  /** The resume BUILD 01's "Built from" row was switched to; null builds from the profile. */
  resumeId: string | null;
  setResumeId: (resumeId: string | null) => void;
};

/**
 * What Build Resume starts from (toreview §139): the profile, as the BUILD boards draw it, or one
 * of the user's resumes. BUILD 01 picks it and every later BUILD screen reads it, so it lives
 * outside the screens; BUILD 01 resets it when the flow is left.
 */
export const useBuildSourceStore = create<BuildSourceState>((set) => ({
  resumeId: null,
  setResumeId: (resumeId) => set({ resumeId }),
}));
