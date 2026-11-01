import { create } from 'zustand';

type ShareState = {
  /** What another app shared, from `ShareHost` to the screen that reads it. */
  text: string | null;
  setText: (text: string | null) => void;
};

export const useShareStore = create<ShareState>((set) => ({
  text: null,
  setText: (text) => set({ text }),
}));
