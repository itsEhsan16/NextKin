import { create } from 'zustand';

// Deep import for the same reason `sessionStore` uses one: the '@/lib' barrel pulls in haptics,
// the pickers and the share sheet, and this module runs its read at import time.
import { storage } from '@/lib/storage';

const STORAGE_KEY = 'prefs.onboardingSeen';

type OnboardingState = {
  /** Whether the three slides have been walked (or skipped) once on this device. */
  seen: boolean;
  markSeen: () => void;
  /**
   * Puts the flow back to its first-run state. Used by the tests; there is no UI for it yet, so
   * replaying onboarding on a device means reinstalling or clearing storage.
   */
  reset: () => void;
};

/**
 * Whether first-run onboarding is behind us.
 *
 * Separate from the session because they answer different questions: signing out should return
 * you to the auth landing, not replay three slides you have already read. Like the session, the
 * read is synchronous at import time, so the first frame is already on the right side of it and
 * there is no flash of the welcome screen for a returning user.
 */
export const useOnboardingStore = create<OnboardingState>((set) => ({
  seen: storage.get<boolean>(STORAGE_KEY) ?? false,
  markSeen: () => {
    storage.set(STORAGE_KEY, true);
    set({ seen: true });
  },
  reset: () => {
    storage.remove(STORAGE_KEY);
    set({ seen: false });
  },
}));
