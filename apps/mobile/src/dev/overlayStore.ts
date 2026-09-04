import { create } from 'zustand';

import { storage } from '@/lib/storage';

import type { Board } from './figmaRefs';
import { FIGMA_REFS } from './figmaRefs.generated';

const STORAGE_KEY = 'dev.figmaOverlay';

/** 100% is the most useful setting: flash between it and 0 and any drift jumps out. */
export const OPACITY_STEPS = [0.25, 0.5, 0.75, 1] as const;

/** Both pages carry the same screens, so the picker shows one board at a time. */
export const BOARDS = [390, 520] as const satisfies readonly Board[];

type Persisted = { nodeId: string; opacity: number; offsetY: number; board: Board };

type OverlayState = Persisted & {
  visible: boolean;
  show: () => void;
  hide: () => void;
  setNodeId: (nodeId: string) => void;
  setOpacity: (opacity: number) => void;
  /** Switches page, holding the same artboard where the other page draws it too. */
  setBoard: (board: Board) => void;
  nudge: (delta: number) => void;
};

const restored = __DEV__ ? storage.get<Persisted>(STORAGE_KEY) : undefined;

/** 390 first: on a 390dp phone that render is 1:1, which is the closest reading available. */
const defaultBoard: Board = 390;
const firstRef =
  FIGMA_REFS.find((ref) => ref.frameWidth === (restored?.board ?? defaultBoard)) ?? FIGMA_REFS[0];

export const useOverlayStore = create<OverlayState>((set, get) => {
  const persist = () => {
    const { nodeId, opacity, offsetY, board } = get();
    storage.set(STORAGE_KEY, { nodeId, opacity, offsetY, board });
  };

  return {
    nodeId: restored?.nodeId ?? firstRef?.id ?? '',
    opacity: restored?.opacity ?? 0.5,
    offsetY: restored?.offsetY ?? 0,
    board: restored?.board ?? defaultBoard,
    visible: false,
    show: () => set({ visible: true }),
    hide: () => set({ visible: false }),
    setNodeId: (nodeId) => {
      set({ nodeId, offsetY: 0 });
      persist();
    },
    setBoard: (board) => {
      // Comparing the same screen across the two pages is the point, so carry the selection
      // over by name; only 02b has no twin, and that falls back to the first frame.
      const current = FIGMA_REFS.find((ref) => ref.id === get().nodeId);
      const onBoard = FIGMA_REFS.filter((ref) => ref.frameWidth === board);
      const twin = onBoard.find((ref) => ref.name === current?.name) ?? onBoard[0];
      set({ board, nodeId: twin?.id ?? get().nodeId, offsetY: 0 });
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
