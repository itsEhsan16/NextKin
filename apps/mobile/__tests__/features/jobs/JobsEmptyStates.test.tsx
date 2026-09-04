import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { resetMockRepos } from '@/data/repos';
import { appliedFilterChips, JobsScreen, useJobsStore } from '@/features/jobs';

const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), back: jest.fn() }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/**
 * All three empty states are exercised in ONE render, walking the segmented control.
 *
 * Splitting them into a test each is the obvious shape, but it does not survive: JobsScreen owns
 * a VirtualizedList (FlashList is mocked to FlatList), whose cell-update timers fire outside
 * act(). Across repeated mount/unmount cycles one lands inside the next test's act() scope and
 * wedges React's act queue — after which every render silently commits an empty tree. A single
 * mount keeps the list alive throughout and never gives a stray timer that window.
 */
async function renderEmptyJobs() {
  useMockModeStore.setState({ mode: 'empty' });
  const queryClient = createQueryClient();
  clients.push(queryClient);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>
        <JobsScreen />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

/** StateView hides the visible message so the title's a11y label is the only summary read out. */
const expectMessage = (message: string) =>
  expect(screen.getByText(message, { includeHiddenElements: true })).toBeOnTheScreen();

const INITIAL = useJobsStore.getState();

describe('Jobs empty states (JOBS 06 / 07 / 08)', () => {
  beforeEach(() => {
    resetMockRepos();
    useJobsStore.setState(INITIAL, true);
  });

  afterEach(async () => {
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
  });

  it('gives every tab its own dead-end copy and a way out', async () => {
    await renderEmptyJobs();

    // JOBS 06 — Discover: the dead end is the filters, so both ways out act on them.
    expect(await screen.findByText('No jobs match these filters')).toBeOnTheScreen();
    expectMessage('Try removing a filter, widening your salary range, or including hybrid roles.');

    fireEvent.press(screen.getByLabelText('Widen my filters'));
    expect(useJobsStore.getState().filtersOpen).toBe(true);

    // JOBS 06 draws two ways to clear: "Clear all" beside the chip row and "Clear all filters"
    // in the empty state itself. Both carry the same label, so take the second — the empty one.
    const clearAll = screen.getAllByLabelText('Clear all filters');
    expect(clearAll).toHaveLength(2);
    fireEvent.press(clearAll[1]!);
    await waitFor(() => expect(appliedFilterChips(useJobsStore.getState().filters)).toEqual([]));

    // JOBS 07 — Saved: nothing bookmarked yet.
    fireEvent.press(screen.getByRole('tab', { name: 'Saved' }));
    expect(await screen.findByText('Nothing saved yet')).toBeOnTheScreen();
    expectMessage(
      'Bookmark jobs to compare them here — salary, match criteria and requirements side by side.',
    );
    expect(screen.getByLabelText("Browse today's picks")).toBeOnTheScreen();

    // JOBS 08 — Applied: nothing submitted yet, so the way out is the Discover list.
    fireEvent.press(screen.getByRole('tab', { name: 'Applied' }));
    expect(await screen.findByText('No applications yet')).toBeOnTheScreen();
    expectMessage('Applications you submit appear here, with status updates as employers respond.');

    fireEvent.press(screen.getByLabelText('Find jobs to apply to'));
    await waitFor(() => expect(useJobsStore.getState().segment).toBe('discover'));
  });
});
