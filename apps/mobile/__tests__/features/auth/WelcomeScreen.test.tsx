import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useOnboardingStore, useSessionStore, WelcomeScreen } from '@/features/auth';
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

const ONBOARDING = useOnboardingStore.getState();
const SESSION = useSessionStore.getState();

const renderScreen = () =>
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <WelcomeScreen />
    </SafeAreaProvider>,
  );

/** The signed-out landing (toreview.md §172). */
describe('WelcomeScreen', () => {
  beforeEach(() => {
    storage.remove('prefs.onboardingSeen');
    useOnboardingStore.setState({ seen: false });
    mockPush.mockClear();
  });

  afterEach(async () => {
    await cleanup();
    storage.remove('prefs.onboardingSeen');
    useOnboardingStore.setState(ONBOARDING, true);
    useSessionStore.setState(SESSION, true);
  });

  it('shows the brand, one promise and the way in', async () => {
    await renderScreen();

    expect(screen.getByRole('header', { name: 'NextKin' })).toBeOnTheScreen();
    expect(screen.getByText(/Resumes that get/)).toBeOnTheScreen();
    expect(screen.getByText('Made for each job. Never made up.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Get started' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeOnTheScreen();
  });

  it('opens sign-up from Get started', async () => {
    await renderScreen();
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Get started' })));

    expect(mockPush).toHaveBeenCalledWith('/(auth)/sign-up');
    expect(useOnboardingStore.getState().seen).toBe(true);
  });

  it('opens sign-in from the footer', async () => {
    await renderScreen();
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Sign in' })));

    expect(mockPush).toHaveBeenCalledWith('/(auth)/sign-in');
  });

  it('signs straight in with Google on the mock', async () => {
    await renderScreen();
    await act(async () =>
      fireEvent.press(screen.getByRole('button', { name: 'Continue with Google' })),
    );

    expect(useSessionStore.getState().status).toBe('signed_in');
  });
});
