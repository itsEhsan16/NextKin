import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { resetMockRepos } from '@/data/repos';
// Deep import on purpose — see the note in ProfileEntryForms.test.tsx.
import { ExperienceFormScreen } from '@/features/profile/screens/ExperienceFormScreen';

const mockBack = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), back: mockBack, replace: jest.fn() }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const settle = (ms = 3000) => act(() => jest.advanceTimersByTimeAsync(ms));

describe('Profile entry forms — the profile fails to load (V2 §7.6)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
    mockBack.mockClear();
    // Set before the render: the first fetch has to be the failing one.
    useMockModeStore.setState({ mode: 'error' });
  });

  afterEach(async () => {
    await act(() => jest.runOnlyPendingTimersAsync());
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
    jest.useRealTimers();
  });

  it('says so, offers a retry, and pins no Save over a form that never arrived', async () => {
    const queryClient = createQueryClient();
    clients.push(queryClient);
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <QueryClientProvider client={queryClient}>
          <ExperienceFormScreen id="exp_1" />
        </QueryClientProvider>
      </SafeAreaProvider>,
    );
    await settle();

    expect(screen.getByText("Couldn't load your profile")).toBeOnTheScreen();
    // A page with nothing to save carries no action bar.
    expect(screen.queryByLabelText(/^Save/)).not.toBeOnTheScreen();
    // Back is a plain pop here: there is no draft to lose.
    expect(screen.getByLabelText('Back')).toBeOnTheScreen();

    await act(async () => fireEvent.press(screen.getByLabelText('Try again')));
    await settle();
    // Still failing — the mode has not changed — so the state holds rather than blanking out.
    expect(screen.getByText("Couldn't load your profile")).toBeOnTheScreen();
  }, 60000);
});
