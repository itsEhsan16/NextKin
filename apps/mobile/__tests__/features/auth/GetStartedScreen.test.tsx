import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { GetStartedScreen, useSessionStore } from '@/features/auth';
import { storage } from '@/lib';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, navigate: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const SESSION = useSessionStore.getState();

const renderScreen = () =>
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <GetStartedScreen />
    </SafeAreaProvider>,
  );

/** Where a signed-out reader chooses (Figma 296:2982). */
describe('GetStartedScreen', () => {
  beforeEach(() => {
    storage.remove('prefs.session');
    useSessionStore.setState({ status: 'signed_out' });
    mockPush.mockClear();
  });

  afterEach(async () => {
    await cleanup();
    storage.remove('prefs.session');
    useSessionStore.setState(SESSION, true);
  });

  it('draws the lock-up, the hero and both ways forward', async () => {
    await renderScreen();

    expect(screen.getByRole('header', { name: 'NextKin' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'A brighter you ahead.' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Create an account' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeOnTheScreen();
  });

  it('sends each button to its own route, and signs nobody in on its own', async () => {
    await renderScreen();

    await act(async () => fireEvent.press(screen.getByLabelText('Create an account')));
    expect(mockPush).toHaveBeenCalledWith('/(auth)/sign-up');

    await act(async () => fireEvent.press(screen.getByLabelText('Sign in')));
    expect(mockPush).toHaveBeenCalledWith('/(auth)/sign-in');

    // Neither is a shortcut into the app: the session is untouched until a form is submitted.
    expect(useSessionStore.getState().status).toBe('signed_out');
  }, 60000);
});
