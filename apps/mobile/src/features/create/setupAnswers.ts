import { create } from 'zustand';

import type { ZeroYears } from '@/data/models';
import { storage } from '@/lib/storage';

const KEY = 'onboarding.setupAnswers';

export type SetupAnswers = { role: string; years: ZeroYears | null };

type SetupState = SetupAnswers & {
  /** Whether the quick setup has been answered or skipped on this device. */
  done: boolean;
  save: (answers: SetupAnswers) => void;
  skip: () => void;
  reset: () => void;
};

const stored = storage.get<SetupAnswers & { done: boolean }>(KEY);

/**
 * The two answers a new account gives right after sign-up (toreview.md §172): the role they
 * want and how long they have worked. Kept on the device and used to prefill the flows that ask
 * the same thing (Zero Resume), so nobody is asked twice.
 */
export const useSetupAnswers = create<SetupState>((set) => ({
  role: stored?.role ?? '',
  years: stored?.years ?? null,
  done: stored?.done ?? false,
  save: (answers) => {
    storage.set(KEY, { ...answers, done: true });
    set({ ...answers, done: true });
  },
  skip: () => {
    set((state) => {
      storage.set(KEY, { role: state.role, years: state.years, done: true });
      return { done: true };
    });
  },
  reset: () => {
    storage.remove(KEY);
    set({ role: '', years: null, done: false });
  },
}));

/** Roles offered as one-tap answers. Typing anything else works too. */
export const SUGGESTED_ROLES = [
  'Software Engineer',
  'Product Designer',
  'Product Manager',
  'Data Analyst',
  'Marketing Manager',
  'Sales Executive',
] as const;
