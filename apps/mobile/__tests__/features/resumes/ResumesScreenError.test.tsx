import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { resetMockRepos } from '@/data/repos';
import { ResumesScreen, useResumesStore } from '@/features/resumes';
import { CreateSheetProvider } from '@/navigation';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), back: jest.fn() }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const INITIAL = useResumesStore.getState();
const clients: QueryClient[] = [];

/** One mount per file — see the test-infra note in the plan's Phase 3 status. */
describe('ResumesScreen error state', () => {
  beforeEach(() => {
    resetMockRepos();
    useResumesStore.setState(INITIAL, true);
  });

  afterEach(async () => {
    await Promise.all(clients.map((client) => client.cancelQueries()));
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
  });

  it('renders the error state with retry', async () => {
    useMockModeStore.setState({ mode: 'error' });
    const queryClient = createQueryClient();
    clients.push(queryClient);
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <QueryClientProvider client={queryClient}>
          <CreateSheetProvider>
            <ResumesScreen />
          </CreateSheetProvider>
        </QueryClientProvider>
      </SafeAreaProvider>,
    );

    expect(
      await screen.findByText("Couldn't load your documents", {}, { timeout: 15000 }),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Try again')).toBeOnTheScreen();
  }, 30000);
});
