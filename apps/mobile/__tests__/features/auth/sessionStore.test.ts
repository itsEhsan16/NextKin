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
