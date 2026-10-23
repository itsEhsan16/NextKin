import { create } from 'zustand';

import type { ToastTone } from './Toast';

type AppToastState = {
  message: string | null;
  tone: ToastTone;
  show: (message: string, tone?: ToastTone) => void;
  hide: () => void;
};

/**
 * The app-wide toast: one bar above every screen, for a result that outlives the screen that
 * caused it. A profile form saves and pops back; the "Saved" has to appear on whatever screen it
 * lands on, and a host inside the tabs would be covered by any pushed screen.
 *
 * Screens that already own a toast (the run screens, Job Detail, the resume surfaces) keep using
 * theirs; this is for the rest.
 */
export const useAppToast = create<AppToastState>((set) => ({
  message: null,
  tone: 'success',
  show: (message, tone = 'success') => set({ message, tone }),
  hide: () => set({ message: null }),
}));

/** Raise the app-wide toast from anywhere (a mutation's callback, an action hook). */
export const showAppToast = (message: string, tone?: ToastTone) =>
  useAppToast.getState().show(message, tone);
