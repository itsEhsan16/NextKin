import type { MockModeStorage } from '@nextkin/shared/mock';

/**
 * The web half of the storage adapter @nextkin/shared asks for. Mirrors the mobile wrapper's
 * shape (`apps/mobile/src/lib/storage.ts`) over `localStorage` instead of expo-sqlite, and is
 * just as best-effort: a browser with site data blocked must not crash the UI.
 *
 * UI preferences only — never domain data.
 */
export const storage: MockModeStorage & { remove(key: string): void } = {
  get<T>(key: string): T | null {
    try {
      const raw = window.localStorage.getItem(key);
      return raw == null ? null : (JSON.parse(raw) as T);
    } catch {
      return null;
    }
  },
  set<T>(key: string, value: T): void {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore
    }
  },
  remove(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};
