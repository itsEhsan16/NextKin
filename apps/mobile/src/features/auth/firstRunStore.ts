import { create } from 'zustand';

type FirstRunState = {
  justSignedUp: boolean;
  mark: () => void;
  consume: () => void;
};

/**
 * Tells Home an account was created a moment ago, so it can open the first-resume screen (toreview
 * §145.2). In memory on purpose: it lasts from the sign-up to the first frame of Home, and signing
 * in on another day is not a first run.
 */
export const useFirstRunStore = create<FirstRunState>((set) => ({
  justSignedUp: false,
  mark: () => {
    set({ justSignedUp: true });
  },
  consume: () => set({ justSignedUp: false }),
}));
