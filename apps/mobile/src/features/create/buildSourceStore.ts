import { create } from 'zustand';

import { defaultTailorPick, tailorableResumes } from '@/data/models';
import { useResumes } from '@/data/queries';

type BuildSourceState = {
  /** What "Build from" was set to: a resume, the profile (null), or nothing yet (undefined). */
  picked: string | null | undefined;
  pick: (source: string | null) => void;
  reset: () => void;
};

/**
 * What a resume for a job starts from (toreview §139, §145.1). BUILD 01 picks it and every later
 * BUILD screen reads it, so it lives outside the screens; BUILD 01 resets it when the flow is left.
 */
export const useBuildSourceStore = create<BuildSourceState>((set) => ({
  picked: undefined,
  pick: (picked) => set({ picked }),
  reset: () => set({ picked: undefined }),
}));

/**
 * The resume this flow builds from, or null for the profile. Until "Build from" is changed that is
 * the base resume, else the newest: an upload keeps its own structure, which a build from the
 * profile can't (owner, 2026-11-01). Someone with no resume builds from the profile.
 */
export function useBuildSource(): string | null {
  const picked = useBuildSourceStore((state) => state.picked);
  const resumes = useResumes();
  if (picked !== undefined) return picked;
  return defaultTailorPick(tailorableResumes(resumes.data ?? [])) ?? null;
}
