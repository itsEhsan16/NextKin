import { create } from 'zustand';

type HomeState = {
  /** The hamburger menu sheet (Figma 1:15 opens it; the sheet itself has no artboard). */
  menuOpen: boolean;
  openMenu: () => void;
  closeMenu: () => void;

  /**
   * TAILOR 00c: the job link found on the clipboard, kept after the dialog closes so it still has
   * its words during the exit. 'reading' while the host reads it, 'open' while asked, then
   * 'closed' — once per link, whatever the answer.
   */
  copiedLink: string | null;
  copiedLinkPhase: 'reading' | 'open' | 'closed';
  foundCopiedLink: (url: string) => void;
  openCopiedLink: () => void;
  closeCopiedLink: () => void;
  /** Home lost focus before the link was read: drop it rather than open over another tab. */
  dropPendingCopiedLink: () => void;
};

/** Home's cross-component state. Its sheet and dialog are hosted over the tab bar, not in the screen. */
export const useHomeStore = create<HomeState>((set) => ({
  menuOpen: false,
  openMenu: () => set({ menuOpen: true }),
  closeMenu: () => set({ menuOpen: false }),

  copiedLink: null,
  copiedLinkPhase: 'closed',
  foundCopiedLink: (url) => set({ copiedLink: url, copiedLinkPhase: 'reading' }),
  openCopiedLink: () => set({ copiedLinkPhase: 'open' }),
  closeCopiedLink: () => set({ copiedLinkPhase: 'closed' }),
  dropPendingCopiedLink: () =>
    set((state) =>
      state.copiedLinkPhase === 'reading' ? { copiedLink: null, copiedLinkPhase: 'closed' } : state,
    ),
}));
