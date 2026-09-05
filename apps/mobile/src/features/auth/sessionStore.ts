import { create } from 'zustand';

// Deep import, exactly as `src/theme/appearance.ts` does: the '@/lib' barrel also pulls in
// haptics, the image/document pickers and the share sheet, and this module runs its read at
// import time — a store initialiser must not drag half of Expo in with it.
import { storage } from '@/lib/storage';

/** Whether the mock account is signed in. The real auth screens (V2 §7.1) are design-gated. */
export type SessionStatus = 'signed_in' | 'signed_out';

const STORAGE_KEY = 'prefs.session';

type SessionState = {
  status: SessionStatus;
  signIn: () => void;
  signOut: () => void;
  deleteAccount: () => void;
};

/**
 * The session seam (plan §Phase 9A). It holds a flag and nothing else — no tokens, no user —
 * so when V2 §7.1's screens arrive the only thing that changes is what sets the flag.
 */
export const useSessionStore = create<SessionState>((set) => ({
  // Signed in when nothing is stored, because the mock account is pre-seeded like every other
  // fixture: every existing test and every Maestro flow expects the tabs on launch, and there is
  // no real credential to be missing. A signed-out default would put a wall in front of screens
  // that have nothing behind it.
  //
  // The read is synchronous (expo-sqlite/kv-store), so the store is already correct before the
  // first render — which is why the route gate below has no loading state of its own and no
  // hydration flash is possible.
  status: storage.get<SessionStatus>(STORAGE_KEY) ?? 'signed_in',
  signIn: () => {
    storage.set(STORAGE_KEY, 'signed_in');
    set({ status: 'signed_in' });
  },
  signOut: () => {
    storage.set(STORAGE_KEY, 'signed_out');
    set({ status: 'signed_out' });
  },
  // Removes the key instead of writing 'signed_out': deleting an account is meant to leave
  // nothing behind, so the next cold start reads no preference and comes up as a fresh mock
  // account rather than as the deleted one, signed out.
  deleteAccount: () => {
    storage.remove(STORAGE_KEY);
    set({ status: 'signed_out' });
  },
}));
