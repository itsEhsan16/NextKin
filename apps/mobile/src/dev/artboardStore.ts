import { create } from 'zustand';

import { storage } from '@/lib/storage';

const STORAGE_KEY = 'dev.artboardMode';

type ArtboardState = {
  /** When true, the whole tree lays out at the 520px artboard width and is scaled to fit. */
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  toggle: () => void;
};

/**
 * Dev-only switch behind `<ArtboardMode>`. Persisted so it survives a Fast Refresh while you
 * are walking screens against Figma.
 */
export const useArtboardStore = create<ArtboardState>((set, get) => ({
  enabled: __DEV__ ? (storage.get<boolean>(STORAGE_KEY) ?? false) : false,
  setEnabled: (enabled) => {
    storage.set(STORAGE_KEY, enabled);
    set({ enabled });
  },
  toggle: () => get().setEnabled(!get().enabled),
}));
