import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';

export type CreateSheetApi = {
  /**
   * 0 = closed, 1 = open. Owned by the sheet animation; read by the FAB so its "+ → ✕"
   * rotation, the scrim and the sheet all move from one value.
   */
  progress: SharedValue<number>;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
};

const CreateSheetContext = createContext<CreateSheetApi | null>(null);

/** Hosts the shared state for the global "+" sheet; mount once above the tab navigator. */
export function CreateSheetProvider({ children }: { children: ReactNode }) {
  const progress = useSharedValue(0);
  const [isOpen, setOpen] = useState(false);

  const open = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((value) => !value), []);

  const api = useMemo<CreateSheetApi>(
    () => ({ progress, isOpen, open, close, toggle }),
    [close, isOpen, open, progress, toggle],
  );

  return <CreateSheetContext.Provider value={api}>{children}</CreateSheetContext.Provider>;
}

export function useCreateSheet(): CreateSheetApi {
  const api = useContext(CreateSheetContext);
  if (!api) throw new Error('useCreateSheet must be used inside <CreateSheetProvider>.');
  return api;
}
