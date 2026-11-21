import { create } from 'zustand';

/**
 * Set the moment any request is answered 426 (the server's version floor, P3-07): this build is
 * below the oldest version the server still serves, so every request will keep failing. The app
 * then shows only the update screen (`features/system/AppUpdateHost`). It never clears in this
 * run: the fix is a new build, which starts the app again.
 */
type UpgradeRequiredState = {
  required: boolean;
  /** The version the server asked for, when it said. */
  minimumVersion: string | null;
  require: (minimumVersion: string | null) => void;
};

export const useUpgradeRequired = create<UpgradeRequiredState>()((set) => ({
  required: false,
  minimumVersion: null,
  require: (minimumVersion) => set({ required: true, minimumVersion }),
}));
