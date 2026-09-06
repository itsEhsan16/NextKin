import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { resetMockRepos } from '@/data/repos';
import { NewInterviewSetScreen } from '@/features/interview';

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
describe('NewInterviewSetScreen error state', () => {
  beforeEach(() => {
    resetMockRepos();
  });

  afterEach(async () => {
    await Promise.all(clients.map((client) => client.cancelQueries()));
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
  });

  it('shows the canonical retry state and never offers the run while the plan is unknown', async () => {
    useMockModeStore.setState({ mode: 'error' });
    const queryClient = createQueryClient();
    clients.push(queryClient);
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <QueryClientProvider client={queryClient}>
          <NewInterviewSetScreen />
        </QueryClientProvider>
      </SafeAreaProvider>,
    );

    const retry = await screen.findByText('Try again', {}, { timeout: 15000 });
    // §13.5: an allowance that could not be read is unknown, not unlimited — no primary at all.
    expect(screen.queryByLabelText('Write questions')).toBeNull();
    expect(screen.queryByLabelText('See Pro plans')).toBeNull();

    useMockModeStore.setState({ mode: 'normal' });
    await act(async () => fireEvent.press(retry));

    await waitFor(
      () => {
        expect(screen.getByLabelText('Write questions')).toBeOnTheScreen();
        expect(screen.queryByText('Try again')).toBeNull();
      },
      { timeout: 15000 },
    );
  }, 40000);
});
