import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { SignInScreen, useSessionStore } from '@/features/auth';
import { storage } from '@/lib';

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const INITIAL = useSessionStore.getState();

/** The design-gated stand-in for V2 §7.1 (plan §Phase 9A). `Screen` reads safe-area insets. */
describe('SignInScreen', () => {
  beforeEach(() => {
    storage.remove('prefs.session');
    useSessionStore.setState({ status: 'signed_out' });
  });

  afterEach(async () => {
    await cleanup();
    storage.remove('prefs.session');
    useSessionStore.setState(INITIAL, true);
  });

  it('offers the three options and signs into the mock account', async () => {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <SignInScreen />
      </SafeAreaProvider>,
    );

    expect(screen.getByRole('header', { name: 'NextKin' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Continue with Apple' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Continue with email' })).toBeOnTheScreen();
    // The copy has to keep saying this out loud while the screen is a stub.
    expect(screen.getByText(/design-gated/)).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText('Continue with Google'));

    expect(useSessionStore.getState().status).toBe('signed_in');
    expect(storage.get('prefs.session')).toBe('signed_in');
  });
});
