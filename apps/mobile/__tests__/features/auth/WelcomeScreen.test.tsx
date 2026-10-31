import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useOnboardingStore, WelcomeScreen } from '@/features/auth';
import { storage } from '@/lib';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), back: jest.fn(), replace: mockReplace }),
  // Rendered rather than swallowed, so a redirect is visible to the assertions below.
  Redirect: ({ href }: { href: string }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock is hoisted above imports.
    const { Text } = require('react-native') as typeof import('react-native');
    return <Text testID="redirect">{href}</Text>;
  },
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const ONBOARDING = useOnboardingStore.getState();

const renderScreen = () =>
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <WelcomeScreen />
    </SafeAreaProvider>,
  );

/** The first frame of a first run (Figma 307:4153). */
describe('WelcomeScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    storage.remove('prefs.onboardingSeen');
    useOnboardingStore.setState({ seen: false });
    mockReplace.mockClear();
  });

  afterEach(async () => {
    await act(() => jest.runOnlyPendingTimersAsync());
    await cleanup();
    storage.remove('prefs.onboardingSeen');
    useOnboardingStore.setState(ONBOARDING, true);
    jest.useRealTimers();
  });

  it('draws the wordmark and both taglines', async () => {
    await renderScreen();

    expect(screen.getByRole('header', { name: 'NextKin' })).toBeOnTheScreen();
    expect(screen.getByText('JOBS   RESUMES   GROWTH')).toBeOnTheScreen();
    expect(screen.getByText(/WITH AI THAT WON’T LIE/)).toBeOnTheScreen();
    expect(screen.queryByTestId('redirect')).not.toBeOnTheScreen();
  });

  it('advances itself, because the artboard draws no control', async () => {
    await renderScreen();

    expect(mockReplace).not.toHaveBeenCalled();
    await act(() => jest.advanceTimersByTimeAsync(2000));

    expect(mockReplace).toHaveBeenCalledWith('/(auth)/onboarding');
  });

  it('lets a tap take it early rather than waiting out the hold', async () => {
    await renderScreen();

    await act(async () => fireEvent.press(screen.getByLabelText('Continue')));

    expect(mockReplace).toHaveBeenCalledWith('/(auth)/onboarding');
  });

  it('sends a returning reader past it, with no flash of the wash', async () => {
    useOnboardingStore.setState({ seen: true });
    await renderScreen();

    // The flag is read synchronously, so the redirect is the first frame — not something an
    // effect gets to after the welcome screen has already been painted.
    expect(screen.getByTestId('redirect')).toHaveTextContent('/(auth)/get-started');
    expect(screen.queryByRole('header', { name: 'NextKin' })).not.toBeOnTheScreen();

    await act(() => jest.advanceTimersByTimeAsync(2000));
    // And it does not also run the hold: nothing should be replacing the route behind a redirect.
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('does not leave its timer running after it unmounts', async () => {
    const view = await renderScreen();
    await view.unmount();

    await act(() => jest.advanceTimersByTimeAsync(2000));
    expect(mockReplace).not.toHaveBeenCalled();
  }, 60000);
});
