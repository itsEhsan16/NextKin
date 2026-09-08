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

  it('starts signed out when nothing is stored', () => {
    // A device that has never been signed in gets the (auth) group as its initial route, which
    // is what puts the welcome screen and the onboarding slides in front of a first run.
    expect(storage.get('prefs.session')).toBeNull();
    expect(useSessionStore.getState().status).toBe('signed_out');
  });

  // The assertions above all run against the store this file imported, which was constructed once
  // with an empty Map — a hardcoded `status: 'signed_out'` would satisfy every one of them. The two
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

  it('evaluates to a signed-out device after a delete', () => {
    useSessionStore.getState().signOut();
    useSessionStore.getState().deleteAccount();

    jest.isolateModules(() => {
      const coldStart =
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- a fresh evaluation.
        (require('@/features/auth/sessionStore') as typeof import('@/features/auth/sessionStore'))
          .useSessionStore;
      // deleteAccount removes the key rather than writing 'signed_out', so a deleted account
      // leaves the device exactly as it shipped: no stored preference, and signed out. The two
      // now agree, but the distinction still matters — a written 'signed_out' would survive the
      // reinstall this is meant to be indistinguishable from.
      expect(storage.get('prefs.session')).toBeNull();
      expect(coldStart.getState().status).toBe('signed_out');
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

  it('forgets the key on delete, so the next cold start is an untouched device', () => {
    useSessionStore.getState().signOut();
    useSessionStore.getState().deleteAccount();

    expect(useSessionStore.getState().status).toBe('signed_out');
    // Nothing on disk, rather than 'signed_out' written there: the difference is invisible to
    // the session but not to onboarding, which reads its own key and is left equally untouched.
    expect(storage.get('prefs.session')).toBeNull();
  });
});
