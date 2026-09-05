import { useSessionStore } from '@/features/auth';
import { storage } from '@/lib';

const INITIAL = useSessionStore.getState();

/**
 * The session seam (plan §Phase 9A). Nothing here is React, so no act() and no mount — the
 * store's contract is that the value is already right before the first render.
 *
 * jest.setup's kv-store is one module-scoped Map shared by every suite in this file, so the key
 * is cleared going in AND coming out.
 */
describe('Session store', () => {
  beforeEach(() => {
    storage.remove('prefs.session');
    useSessionStore.setState(INITIAL, true);
  });

  afterEach(() => {
    storage.remove('prefs.session');
    useSessionStore.setState(INITIAL, true);
  });

  it('starts signed in when nothing is stored', () => {
    expect(storage.get('prefs.session')).toBeNull();
    expect(useSessionStore.getState().status).toBe('signed_in');
  });

  // The assertions above all run against the store this file imported, which was constructed once
  // with an empty Map — a hardcoded `status: 'signed_in'` would satisfy every one of them. The two
  // below evaluate the module again, after the key has been written, so they fail unless the
  // initialiser actually reads storage. That read is what the route gate's "the first frame is
  // already on the right side" rests on; break it and a cold start flashes the wrong screen.
  // (jest.isolateModules gives the re-evaluated module a fresh registry but the same mocked
  // kv-store, so what is seeded out here is what it reads in there.)
  it('reads the stored session when the module is evaluated', () => {
    storage.set('prefs.session', 'signed_out');

    jest.isolateModules(() => {
      const coldStart =
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- a fresh evaluation.
        (require('@/features/auth/sessionStore') as typeof import('@/features/auth/sessionStore'))
          .useSessionStore;
      expect(coldStart.getState().status).toBe('signed_out');
    });
  });

  it('evaluates to a signed-in fresh account after a delete', () => {
    useSessionStore.getState().signOut();
    useSessionStore.getState().deleteAccount();

    jest.isolateModules(() => {
      const coldStart =
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- a fresh evaluation.
        (require('@/features/auth/sessionStore') as typeof import('@/features/auth/sessionStore'))
          .useSessionStore;
      // Had deleteAccount written 'signed_out' instead of removing the key, the next start would
      // come up as the deleted account, signed out, with no way to tell it from a sign-out.
      expect(coldStart.getState().status).toBe('signed_in');
    });
  });

  it('persists a sign-out and restores on sign-in', () => {
    useSessionStore.getState().signOut();
    expect(useSessionStore.getState().status).toBe('signed_out');
    expect(storage.get('prefs.session')).toBe('signed_out');

    useSessionStore.getState().signIn();
    expect(useSessionStore.getState().status).toBe('signed_in');
    expect(storage.get('prefs.session')).toBe('signed_in');
  });

  it('forgets the key on delete, so the next cold start is a fresh mock account', () => {
    useSessionStore.getState().signOut();
    useSessionStore.getState().deleteAccount();

    expect(useSessionStore.getState().status).toBe('signed_out');
    // Not 'signed_out' on disk: with no stored preference the store's initialiser falls back to
    // signed_in, which is the pre-seeded account coming back rather than the deleted one.
    expect(storage.get('prefs.session')).toBeNull();
  });
});
