import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { resetMockRepos } from '@/data/repos';
import { CompanyScreen } from '@/features/jobs';

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
describe('CompanyScreen error state', () => {
  beforeEach(() => {
    resetMockRepos();
  });

  afterEach(async () => {
    await Promise.all(clients.map((client) => client.cancelQueries()));
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
  });

  it('shows the retry state when the job behind the company cannot be read', async () => {
    useMockModeStore.setState({ mode: 'error' });
    const queryClient = createQueryClient();
    clients.push(queryClient);
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <QueryClientProvider client={queryClient}>
          <CompanyScreen jobId="job_stripe" />
        </QueryClientProvider>
      </SafeAreaProvider>,
    );

    expect(
      await screen.findByText("Couldn't load this company", {}, { timeout: 15000 }),
    ).toBeOnTheScreen();
    // With no job there is no company name to head the page with.
    expect(screen.getByRole('header', { name: 'Company' })).toBeOnTheScreen();

    await act(async () => fireEvent.press(screen.getByLabelText('Try again')));
    // The retry puts the page back through its skeleton before the second failure lands, so this
    // waits for the error to COME BACK rather than asserting into that window. An earlier draft
    // waited on the "Try again" label instead and caught the old error state still on screen a
    // frame before the skeleton replaced it — green, and testing nothing.
    // `waitFor` around BOTH assertions, not `findBy` followed by them: pressing retry puts the
    // page back through its skeleton before the second failure lands, and the gap between an
    // awaited find and the next line is enough for React to commit that skeleton. Only
    // re-running the whole assertion tolerates the transient state — and this only ever showed
    // up under full-suite load.
    await waitFor(
      () => {
        expect(screen.getByText("Couldn't load this company")).toBeOnTheScreen();
        // Still recoverable: the page never strands the reader on a dead end.
        expect(screen.getByLabelText('Try again')).toBeOnTheScreen();
      },
      { timeout: 15000 },
    );
  }, 60000);
});
