import { create } from 'zustand';

import type { ToastTone } from '@/ui/Toast';

/** Sheets the Profile screen can raise (plan §Phase 5: pickers + confirms). */
export type ProfileSheet =
  'appearance' | 'language' | 'availability' | 'min-salary' | 'sign-out' | 'delete-account';

type ProfileState = {
  /** Which sheet the host renders. Retained after close — see `closeSheet`. */
  sheet: ProfileSheet | null;
  sheetOpen: boolean;
  /**
   * Transient confirmation for the rows that have no screen of their own. "Rate NextKin" is the
   * only one today: it asks the OS for a review prompt, which is a no-op in Expo Go and silently
   * rate-limited even on a real store build, so the tap has to say something either way.
   */
  toast: string | null;
  toastTone: ToastTone;

  openSheet: (sheet: ProfileSheet) => void;
  closeSheet: () => void;
  /** `tone` defaults to success; a failure passes `error` so it never wears the check. */
  showToast: (message: string, tone?: ToastTone) => void;
  hideToast: () => void;
};

export const useProfileStore = create<ProfileState>((set) => ({
  sheet: null,
  sheetOpen: false,
  toast: null,
  toastTone: 'success',

  openSheet: (sheet) => set({ sheet, sheetOpen: true }),
  // `sheet` is deliberately NOT cleared: the picker must not empty during its 200ms exit.
  closeSheet: () => set({ sheetOpen: false }),
  showToast: (toast, toastTone = 'success') => set({ toast, toastTone }),
  hideToast: () => set({ toast: null }),
}));
