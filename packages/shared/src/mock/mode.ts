import { create } from 'zustand';

// Deep import on purpose: `@/lib` re-exports reducedMotion (Reanimated) and the data layer
// must stay free of UI/native dependencies (and be testable without the Reanimated mock).
import { storage } from '@/lib/storage';

/**
 * Dev-only switch that changes how every mock repo behaves:
 * normal → realistic latency, slow → 2.5s latency, empty → empty results,
 * error → every call rejects. Persisted so it survives reloads while developing.
 */
export type MockMode = 'normal' | 'slow' | 'empty' | 'error';

export type MockModeMeta = { key: MockMode; label: string; description: string };

export const MOCK_MODES: readonly MockModeMeta[] = [
  { key: 'normal', label: 'Normal', description: 'Realistic 300–900ms latency' },
  { key: 'slow', label: 'Slow', description: '2.5s latency to exercise skeletons' },
  { key: 'empty', label: 'Empty', description: 'Every list comes back empty' },
  { key: 'error', label: 'Error', description: 'Every request fails' },
] as const;

const STORAGE_KEY = 'dev.mockMode';

const isMockMode = (value: unknown): value is MockMode =>
  MOCK_MODES.some((meta) => meta.key === value);

/** Only dev builds ever read the persisted value; production always runs "normal". */
function readPersistedMode(): MockMode {
  if (!__DEV__) return 'normal';
  const stored = storage.get<unknown>(STORAGE_KEY);
  return isMockMode(stored) ? stored : 'normal';
}

type MockModeState = {
  mode: MockMode;
  setMode: (mode: MockMode) => void;
};

export const useMockModeStore = create<MockModeState>((set) => ({
  mode: readPersistedMode(),
  setMode: (mode) => {
    storage.set(STORAGE_KEY, mode);
    set({ mode });
  },
}));

/** Non-reactive read for use inside repos. */
export function getMockMode(): MockMode {
  return useMockModeStore.getState().mode;
}
