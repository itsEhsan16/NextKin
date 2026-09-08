import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { Dimensions } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { OnboardingScreen, useOnboardingStore } from '@/features/auth';
import { storage } from '@/lib';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), back: jest.fn(), replace: mockReplace }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** Slides enter animated; the Reanimated mock can leave them at opacity 0. */
const shown = { includeHiddenElements: true } as const;

const ONBOARDING = useOnboardingStore.getState();

const renderScreen = () =>
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <OnboardingScreen />
    </SafeAreaProvider>,
  );

/**
 * Scrolls the pager to a slide the way a finger would, so the dots follow.
 *
 * The offset is measured against the window rather than the 390 the SafeAreaProvider is given:
 * the screen pages on `useWindowDimensions()`, which under Jest is the RN default and not the
 * metrics above. A hardcoded 390 lands between slides and the index never reaches 2.
 */
const swipeTo = async (index: number) => {
  const { width } = Dimensions.get('window');
  return act(async () =>
    fireEvent(screen.getByTestId('onboarding-pager'), 'momentumScrollEnd', {
      nativeEvent: {
        contentOffset: { x: width * index, y: 0 },
        contentSize: { width: width * 3, height: 844 },
        layoutMeasurement: { width, height: 844 },
      },
    }),
  );
};

/** The three first-run slides (Figma 290:969, 290:1031, 295:2867). */
describe('OnboardingScreen', () => {
  beforeEach(() => {
    storage.remove('prefs.onboardingSeen');
    useOnboardingStore.setState({ seen: false });
    mockReplace.mockClear();
  });

  afterEach(async () => {
    await cleanup();
    storage.remove('prefs.onboardingSeen');
    useOnboardingStore.setState(ONBOARDING, true);
  });

  it('renders all three slides, with the copy the board draws', async () => {
    await renderScreen();

    expect(screen.getByText('Create a resume\nthat stands out.', shown)).toBeOnTheScreen();
    expect(screen.getByText('Discover jobs\nthat match you.', shown)).toBeOnTheScreen();
    expect(screen.getByText('Take the next\nstep with confidence.', shown)).toBeOnTheScreen();
    expect(screen.getByLabelText('Slide 1 of 3')).toBeOnTheScreen();
  });

  it('starts on the arrow and swaps it for Get Started on the last slide', async () => {
    await renderScreen();

    expect(screen.getByLabelText('Next, slide 2 of 3')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Get Started')).not.toBeOnTheScreen();

    await swipeTo(2);

    expect(screen.getByLabelText('Get Started')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Next, slide 4 of 3')).not.toBeOnTheScreen();
    expect(screen.getByLabelText('Slide 3 of 3')).toBeOnTheScreen();
  });

  it('offers Skip on the first two slides and not on the last', async () => {
    await renderScreen();

    // Two, because slides 1 and 2 each carry their own — the board draws it per artboard.
    expect(screen.getAllByLabelText('Skip', shown)).toHaveLength(2);
  });

  it('remembers the slides were skipped, and goes on to the landing', async () => {
    await renderScreen();

    await act(async () => fireEvent.press(screen.getAllByLabelText('Skip', shown)[0]!));

    expect(useOnboardingStore.getState().seen).toBe(true);
    expect(storage.get('prefs.onboardingSeen')).toBe(true);
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/get-started');
  });

  it('remembers them when they are walked to the end instead', async () => {
    await renderScreen();
    await swipeTo(2);

    await act(async () => fireEvent.press(screen.getByLabelText('Get Started')));

    expect(useOnboardingStore.getState().seen).toBe(true);
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/get-started');
  }, 60000);
});
