import { create } from 'zustand';

/** Sheets the Profile screen can raise (plan §Phase 5: pickers + confirms). */
export type ProfileSheet =
  | 'appearance'
  | 'language'
  | 'availability'
  | 'min-salary'
  | 'sign-out'
  | 'delete-account';

type ProfileState = {
  /** Which sheet the host renders. Retained after close — see `closeSheet`. */
  sheet: ProfileSheet | null;
  sheetOpen: boolean;

  openSheet: (sheet: ProfileSheet) => void;
  closeSheet: () => void;
};

export const useProfileStore = create<ProfileState>((set) => ({
  sheet: null,
  sheetOpen: false,

  openSheet: (sheet) => set({ sheet, sheetOpen: true }),
  // `sheet` is deliberately NOT cleared: the picker must not empty during its 200ms exit.
  closeSheet: () => set({ sheetOpen: false }),
}));
