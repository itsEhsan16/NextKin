import Storage from 'expo-sqlite/kv-store';

/**
 * Tiny typed wrapper over expo-sqlite's synchronous key-value store.
 * Use ONLY for lightweight UI preferences (view mode, onboarding flags, appearance).
 * Never store domain data here — that belongs to the data layer / future API.
 */
export const storage = {
  get<T>(key: string): T | null {
    try {
      const raw = Storage.getItemSync(key);
      return raw == null ? null : (JSON.parse(raw) as T);
    } catch {
      return null;
    }
  },
  set<T>(key: string, value: T): void {
    try {
      Storage.setItemSync(key, JSON.stringify(value));
    } catch {
      // Storage is best-effort for prefs; never crash the UI over it.
    }
  },
  remove(key: string): void {
    try {
      Storage.removeItemSync(key);
    } catch {
      // ignore
    }
  },
};
