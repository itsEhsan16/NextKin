import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { resetMockRepos } from '@/data/repos';
import { InterviewListScreen } from '@/features/interview';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const clients: QueryClient[] = [];

/** One mount per file — see the test-infra note in the plan's Phase 3 status. */
describe('InterviewListScreen error state', () => {
  beforeEach(() => {
    resetMockRepos();
  });

  afterEach(async () => {
    await Promise.all(clients.map((client) => client.cancelQueries()));
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
  });

  it('shows the canonical retry state and recovers when the mode is normal again', async () => {
    useMockModeStore.setState({ mode: 'error' });
    const queryClient = createQueryClient();
    clients.push(queryClient);
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <QueryClientProvider client={queryClient}>
          <InterviewListScreen />
        </QueryClientProvider>
      </SafeAreaProvider>,
    );

    const retry = await screen.findByText('Try again', {}, { timeout: 15000 });
    expect(screen.getByText("Couldn't load your practice sets")).toBeOnTheScreen();
    // No primary while the list is unknown: nothing to write a set against.
    expect(screen.queryByLabelText('New question set')).toBeNull();

    useMockModeStore.setState({ mode: 'normal' });
    await act(async () => fireEvent.press(retry));

    await waitFor(
      () => {
        expect(screen.getByLabelText('New question set')).toBeOnTheScreen();
        expect(screen.queryByText("Couldn't load your practice sets")).toBeNull();
      },
      { timeout: 15000 },
    );
  }, 40000);
});
