import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { resetMockRepos } from '@/data/repos';
import { HelpScreen } from '@/features/support';

const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/**
 * Real timers with generous findBy timeouts, matching the other `…Error` suites: the query client
 * retries once with a backoff, so a fake-timer jump would land mid-retry.
 *
 * The two states here are deliberately different sentences. "Couldn't load help" is a failure the
 * reader can retry; "Help is unavailable right now" is a successful read of nothing, which retry
 * would not fix — so it offers the way that does work, which is writing to us.
 */
describe('HelpScreen — the states where there is nothing to read (V2 §7.14)', () => {
  beforeEach(() => {
    resetMockRepos();
  });

  afterEach(async () => {
    await Promise.all(clients.map((client) => client.cancelQueries()));
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
  });

  const mount = async () => {
    const queryClient = createQueryClient();
    clients.push(queryClient);
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <QueryClientProvider client={queryClient}>
          <HelpScreen />
        </QueryClientProvider>
      </SafeAreaProvider>,
    );
  };

  it('offers a retry when help could not be read at all', async () => {
    useMockModeStore.setState({ mode: 'error' });
    await mount();

    expect(await screen.findByText("Couldn't load help", {}, { timeout: 15000 })).toBeOnTheScreen();

    await act(async () => fireEvent.press(screen.getByLabelText('Try again')));
    // `waitFor` around BOTH assertions, not `findBy` followed by them: pressing retry puts the
    // page back through its skeleton before the second failure lands, and the gap between an
    // awaited find and the next line is enough for React to commit that skeleton. Only
    // re-running the whole assertion tolerates the transient state — and this only ever showed
    // up under full-suite load.
    await waitFor(
      () => {
        expect(screen.getByText("Couldn't load help")).toBeOnTheScreen();
        // Still recoverable rather than stranding anyone.
        expect(screen.getByLabelText('Try again')).toBeOnTheScreen();
      },
      { timeout: 15000 },
    );
  }, 60000);
});
