import { create } from 'zustand';

import { storage } from '@/lib/storage';

import type { ColorScheme } from './tokens';

/** User-selectable appearance (Profile → Appearance). "system" follows the OS. */
export type AppearancePreference = 'system' | ColorScheme;

const STORAGE_KEY = 'prefs.appearance';

type AppearanceState = {
  preference: AppearancePreference;
  setPreference: (preference: AppearancePreference) => void;
};

export const useAppearanceStore = create<AppearanceState>((set) => ({
  preference: storage.get<AppearancePreference>(STORAGE_KEY) ?? 'system',
  setPreference: (preference) => {
    storage.set(STORAGE_KEY, preference);
    set({ preference });
  },
}));
