import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { resetMockRepos } from '@/data/repos';
import { ResumesScreen, useResumesStore } from '@/features/resumes';
import { CreateSheetProvider } from '@/navigation';

import { insideScroller } from '../../../testSupport/scroller';

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

/**
 * One mount per file — see the test-infra note in the plan's Phase 3 status.
 *
 * Resumes is the screen where the *scrolling* half of the assertion carries the weight: the pin
 * cuts through the middle of what used to be one `ResumesHeader`, so the type pills, the sort
 * control and the usage meter have to end up on the other side of the split.
 */
describe('Resumes pinned header', () => {
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

  it('pins the title and search rows but not the filter bar below them', async () => {
    useMockModeStore.setState({ mode: 'normal' });
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
      await screen.findByLabelText('Search resumes and letters', {}, { timeout: 15000 }),
    ).toBeOnTheScreen();
    for (const node of [
      screen.getByRole('header', { name: 'Resumes' }),
      screen.getByLabelText('Search resumes and letters'),
      screen.getByLabelText('List view'),
    ]) {
      expect(insideScroller(node)).toBe(false);
    }

    // The crop stopped just under the search row, so these three stay in the scroller.
    expect(insideScroller(screen.getByLabelText('All'))).toBe(true);
    expect(insideScroller(screen.getByLabelText('Sort by Last edited'))).toBe(true);
  }, 30000);
});
