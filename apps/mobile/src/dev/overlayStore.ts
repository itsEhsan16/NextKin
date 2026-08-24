import { create } from 'zustand';

import { storage } from '@/lib/storage';

import { FIGMA_REFS } from './figmaRefs.generated';

const STORAGE_KEY = 'dev.figmaOverlay';

/** 100% is the most useful setting: flash between it and 0 and any drift jumps out. */
export const OPACITY_STEPS = [0.25, 0.5, 0.75, 1] as const;

type Persisted = { nodeId: string; opacity: number; offsetY: number };

type OverlayState = Persisted & {
  visible: boolean;
  show: () => void;
  hide: () => void;
  setNodeId: (nodeId: string) => void;
  setOpacity: (opacity: number) => void;
  nudge: (delta: number) => void;
};

const restored = __DEV__ ? storage.get<Persisted>(STORAGE_KEY) : undefined;
const firstRef = FIGMA_REFS[0];

export const useOverlayStore = create<OverlayState>((set, get) => {
  const persist = () => {
    const { nodeId, opacity, offsetY } = get();
    storage.set(STORAGE_KEY, { nodeId, opacity, offsetY });
  };

  return {
    nodeId: restored?.nodeId ?? firstRef?.id ?? '',
    opacity: restored?.opacity ?? 0.5,
    offsetY: restored?.offsetY ?? 0,
    visible: false,
    show: () => set({ visible: true }),
    hide: () => set({ visible: false }),
    setNodeId: (nodeId) => {
      set({ nodeId, offsetY: 0 });
      persist();
    },
    setOpacity: (opacity) => {
      set({ opacity });
      persist();
    },
    nudge: (delta) => {
      set({ offsetY: get().offsetY + delta });
      persist();
    },
  };
});
