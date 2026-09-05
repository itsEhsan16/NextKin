import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore, type MockMode } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { resetMockRepos } from '@/data/repos';
import { GenerationScreen } from '@/features/generations';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const clients: QueryClient[] = [];

async function renderGeneration(id: string, mode: MockMode = 'normal') {
  useMockModeStore.setState({ mode });
  const queryClient = createQueryClient();
  clients.push(queryClient);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>
        <GenerationScreen id={id} />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

/** Real timers, like the other error-state suites: the retry back-off is the thing under test. */
describe('GenerationScreen — the run we could not load', () => {
  beforeEach(() => {
    resetMockRepos();
  });

  afterEach(async () => {
    await Promise.all(clients.map((client) => client.cancelQueries()));
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
  });

  it('shows the load error, which is not the same thing as a failed run', async () => {
    await renderGeneration('gen_active', 'error');

    expect(
      await screen.findByText("Couldn't load this generation", {}, { timeout: 15000 }),
    ).toBeOnTheScreen();
    // The message itself is hidden from the a11y tree; StateView's title is the one summary that
    // carries it, so that is where the copy is asserted.
    expect(
      screen.getByLabelText("Couldn't load this generation. Check your connection and try again."),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Try again')).toBeOnTheScreen();
    // The failure copy belongs to a run that ran and failed; this one never loaded.
    expect(screen.queryByText('Generation failed')).toBeNull();
  }, 30000);

  it('sends an id that no longer resolves to the library instead', async () => {
    await renderGeneration('gen_gone');

    expect(
      await screen.findByText(
        'This generation has finished or was removed',
        {},
        { timeout: 15000 },
      ),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Go to Resumes')).toBeOnTheScreen();
  }, 30000);
});
