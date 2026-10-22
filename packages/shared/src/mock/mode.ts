import { create } from 'zustand';

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

/**
 * Where the switch persists. The data layer must not import a platform storage module, so each
 * host supplies its own: mobile the expo-sqlite kv-store, web `localStorage`. Left unconfigured
 * the switch still works — it just does not survive a reload.
 */
export type MockModeStorage = {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T): void;
};

const STORAGE_KEY = 'dev.mockMode';

let persistence: MockModeStorage | null = null;

const isMockMode = (value: unknown): value is MockMode =>
  MOCK_MODES.some((meta) => meta.key === value);

type MockModeState = {
  mode: MockMode;
  setMode: (mode: MockMode) => void;
};

export const useMockModeStore = create<MockModeState>((set) => ({
  mode: 'normal',
  setMode: (mode) => {
    persistence?.set(STORAGE_KEY, mode);
    set({ mode });
  },
}));

/**
 * Wire up persistence and restore the stored mode.
 *
 * Hosts call this once at module scope, before the first render, so a dev reload comes back in
 * the mode it left in — the behaviour this store had when it read the kv-store directly. Only
 * dev builds should call it; production always runs "normal".
 */
export function configureMockMode(storage: MockModeStorage): void {
  persistence = storage;
  const stored = storage.get<unknown>(STORAGE_KEY);
  if (isMockMode(stored)) useMockModeStore.setState({ mode: stored });
}

/** Non-reactive read for use inside repos. */
export function getMockMode(): MockMode {
  return useMockModeStore.getState().mode;
}
