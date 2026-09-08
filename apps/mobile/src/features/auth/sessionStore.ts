import { create } from 'zustand';

// Deep import, exactly as `src/theme/appearance.ts` does: the '@/lib' barrel also pulls in
// haptics, the image/document pickers and the share sheet, and this module runs its read at
// import time — a store initialiser must not drag half of Expo in with it.
import { storage } from '@/lib/storage';

/** Whether the mock account is signed in. */
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
  // A device with nothing stored has never been signed in, so it starts signed out and the
  // (auth) group becomes the initial route — which is what puts the welcome screen and the three
  // onboarding slides in front of a first run. Before those screens existed this defaulted to
  // 'signed_in', because a signed-out launch could only reach a design-gated stub.
  //
  // The read is synchronous (expo-sqlite/kv-store), so the store is already correct before the
  // first render — which is why the route gate has no loading state of its own and no hydration
  // flash is possible.
  status: storage.get<SessionStatus>(STORAGE_KEY) ?? 'signed_out',
  signIn: () => {
    storage.set(STORAGE_KEY, 'signed_in');
    set({ status: 'signed_in' });
  },
  signOut: () => {
    storage.set(STORAGE_KEY, 'signed_out');
    set({ status: 'signed_out' });
  },
  // Removes the key rather than writing 'signed_out': a deleted account should leave the device
  // in the state it shipped in, which is now genuinely signed out.
  deleteAccount: () => {
    storage.remove(STORAGE_KEY);
    set({ status: 'signed_out' });
  },
}));
