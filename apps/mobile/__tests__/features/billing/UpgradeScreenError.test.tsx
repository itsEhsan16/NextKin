import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { resetMockRepos } from '@/data/repos';
import { UpgradeScreen } from '@/features/billing';

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
describe('UpgradeScreen error state', () => {
  beforeEach(() => {
    resetMockRepos();
  });

  afterEach(async () => {
    await Promise.all(clients.map((client) => client.cancelQueries()));
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
  });

  it('offers the canonical retry when the plans cannot be read', async () => {
    useMockModeStore.setState({ mode: 'error' });
    const queryClient = createQueryClient();
    clients.push(queryClient);
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <QueryClientProvider client={queryClient}>
          <UpgradeScreen reason="docx" />
        </QueryClientProvider>
      </SafeAreaProvider>,
    );

    expect(
      await screen.findByText("Couldn't load the plans", {}, { timeout: 15000 }),
    ).toBeOnTheScreen();
    // §13.1 — a price that could not be read is unknown, not free: nothing is offered for sale
    // and no cap is stated behind a failed load.
    expect(screen.queryByText(/Upgrade to Pro/)).toBeNull();

    const retry = screen.getByLabelText('Try again');
    expect(retry).toBeOnTheScreen();

    // The retry is live rather than decorative: still failing, so the state holds.
    await act(async () => fireEvent.press(retry));
    // Let both refetches fail before the suite tears down, so no mock latency timer outlives it.
    await waitFor(() => expect(queryClient.isFetching()).toBe(0), { timeout: 15000 });
    expect(
      await screen.findByText("Couldn't load the plans", {}, { timeout: 15000 }),
    ).toBeOnTheScreen();
  }, 60000);
});
