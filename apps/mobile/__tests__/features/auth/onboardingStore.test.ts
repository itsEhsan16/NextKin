import { useOnboardingStore } from '@/features/auth';
import { storage } from '@/lib';

const INITIAL = useOnboardingStore.getState();

/**
 * The first-run flag (Figma 307:4152). No React, like `sessionStore.test.ts` — the contract is
 * that the value is already right before the first render.
 *
 * jest.setup's kv-store is one module-scoped Map shared by every suite in this file, so the key
 * is cleared going in AND coming out.
 */
describe('Onboarding store', () => {
  beforeEach(() => {
    storage.remove('prefs.onboardingSeen');
    useOnboardingStore.setState(INITIAL, true);
  });

  afterEach(() => {
    storage.remove('prefs.onboardingSeen');
    useOnboardingStore.setState(INITIAL, true);
  });

  it('has not been seen on a device with nothing stored', () => {
    expect(storage.get('prefs.onboardingSeen')).toBeNull();
    expect(useOnboardingStore.getState().seen).toBe(false);
  });

  it('persists that the slides were walked', () => {
    useOnboardingStore.getState().markSeen();

    expect(useOnboardingStore.getState().seen).toBe(true);
    expect(storage.get('prefs.onboardingSeen')).toBe(true);
  });

  // As with the session, the assertions above run against the store this file imported, which was
  // constructed once with an empty Map — a hardcoded `seen: false` would satisfy them. This one
  // evaluates the module again after the key is written, so it fails unless the initialiser
  // actually reads storage. That read is what stops a returning reader seeing the slides again.
  it('reads the stored flag when the module is evaluated', () => {
    storage.set('prefs.onboardingSeen', true);

    jest.isolateModules(() => {
      const coldStart = (
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- a fresh evaluation.
        require('@/features/auth/onboardingStore') as typeof import('@/features/auth/onboardingStore')
      ).useOnboardingStore;
      expect(coldStart.getState().seen).toBe(true);
    });
  });

  it('is independent of the session, so signing out does not replay the slides', () => {
    useOnboardingStore.getState().markSeen();

    // Nothing the session store does touches this key: they answer different questions.
    storage.remove('prefs.session');

    expect(useOnboardingStore.getState().seen).toBe(true);
    expect(storage.get('prefs.onboardingSeen')).toBe(true);
  });

  it('resets back to a first run', () => {
    useOnboardingStore.getState().markSeen();
    useOnboardingStore.getState().reset();

    expect(useOnboardingStore.getState().seen).toBe(false);
    expect(storage.get('prefs.onboardingSeen')).toBeNull();
  });
});
