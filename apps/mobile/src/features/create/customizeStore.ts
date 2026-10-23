import { create } from 'zustand';

import { initialChoices, type CustomizeChoices } from '@/data/models/customize';

type CustomizeState = {
  /** The Customize screen's choices, by `customizeKey`: they outlive the screen itself. */
  byKey: Readonly<Record<string, CustomizeChoices>>;
  setChoices: (key: string, choices: CustomizeChoices) => void;
};

/**
 * What the user picked on the Customize screen (toreview §114), kept outside the screen because
 * "Create my resume" replaces it with the run: a failed run's "Change my choices" reopens the
 * screen for the same job and resume, and the ticks, places and options are still there.
 */
export const useCustomizeStore = create<CustomizeState>((set) => ({
  byKey: {},
  setChoices: (key, choices) => set((state) => ({ byKey: { ...state.byKey, [key]: choices } })),
}));

/** One entry per job (a listing or a JD) and resume: swapping either starts fresh. */
export const customizeKey = (target: { jobId?: string; jdId?: string }, resumeId: string) =>
  `${target.jobId ? `job:${target.jobId}` : `jd:${target.jdId ?? ''}`}:${resumeId}`;

/** The choices for one key and the setter for them, `initialChoices()` until the first change. */
export function useCustomizeChoices(key: string) {
  const stored = useCustomizeStore((state) => state.byKey[key]);
  const setChoices = useCustomizeStore((state) => state.setChoices);
  const choices = stored ?? initialChoices();
  const update = (next: (current: CustomizeChoices) => CustomizeChoices) =>
    setChoices(key, next(useCustomizeStore.getState().byKey[key] ?? initialChoices()));
  return [choices, update] as const;
}
