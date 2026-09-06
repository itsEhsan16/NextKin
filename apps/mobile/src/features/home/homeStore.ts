import { create } from 'zustand';

type HomeState = {
  /** The hamburger menu sheet (Figma 1:15 opens it; the sheet itself has no artboard). */
  menuOpen: boolean;
  openMenu: () => void;
  closeMenu: () => void;
};

/** Home's only cross-component state. The sheet is hosted over the tab bar, not in the screen. */
export const useHomeStore = create<HomeState>((set) => ({
  menuOpen: false,
  openMenu: () => set({ menuOpen: true }),
  closeMenu: () => set({ menuOpen: false }),
}));
