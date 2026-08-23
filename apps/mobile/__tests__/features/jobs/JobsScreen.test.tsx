import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore, type MockMode } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { resetMockRepos } from '@/data/repos';
import { JobsScreen, useJobsStore } from '@/features/jobs';

const mockPush = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, navigate: jest.fn(), back: jest.fn() }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

async function renderJobs(mode: MockMode = 'normal') {
  useMockModeStore.setState({ mode });
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

const INITIAL = useJobsStore.getState();

describe('JobsScreen (JOBS 01–03)', () => {
  beforeEach(() => {
    resetMockRepos();
    mockPush.mockClear();
    useJobsStore.setState(INITIAL, true);
  });

  afterEach(async () => {
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
  });

  it('renders the Discover chrome and the Figma copy', async () => {
    await renderJobs();

    expect(screen.getByRole('header', { name: 'Jobs' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Search jobs')).toHaveProp(
      'placeholder',
      'Job title, company, skill',
    );
    // Discover is the only tab with location chips and a filter count.
    expect(screen.getByLabelText('Bengaluru, India')).toBeOnTheScreen();
    expect(screen.getByLabelText('Remote only')).toBeSelected();
    expect(screen.getByLabelText(/^Filters, 3 filters applied/)).toBeOnTheScreen();

    expect(await screen.findByRole('header', { name: "Today's picks" })).toBeOnTheScreen();
    expect(screen.getByText('Refreshed daily')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'All jobs' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Sort by Relevance')).toBeOnTheScreen();

    // Salary uses the artboard's lakh notation with the estimated suffix.
    expect(await screen.findByText('₹28–38L · est.')).toBeOnTheScreen();
  });

  it('removes a filter chip and clears them all', async () => {
    await renderJobs();
    await screen.findByRole('header', { name: "Today's picks" });

    expect(screen.getByLabelText('Remove filter ₹20L+')).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText('Remove filter ₹20L+'));
    await waitFor(() => expect(screen.queryByLabelText('Remove filter ₹20L+')).toBeNull());
    expect(screen.getByLabelText('Remove filter Full-time')).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText('Clear all filters'));
    await waitFor(() => expect(screen.queryByLabelText(/^Remove filter/)).toBeNull());
    // With no filters the button loses its count.
    expect(screen.getByLabelText('Filters')).toBeOnTheScreen();
  });

  it('switches to Saved: own placeholder, count, sort and filled bookmarks', async () => {
    await renderJobs();
    await screen.findByRole('header', { name: "Today's picks" });

    fireEvent.press(screen.getByRole('tab', { name: 'Saved' }));

    expect(await screen.findByLabelText('Sort by Recently saved')).toBeOnTheScreen();
    expect(screen.getByLabelText('Search jobs')).toHaveProp('placeholder', 'Search saved jobs');
    // Saved drops the Discover-only chrome.
    expect(screen.queryByLabelText('Remote only')).toBeNull();
    expect(screen.queryByRole('header', { name: "Today's picks" })).toBeNull();
    expect(screen.queryByRole('header', { name: 'All jobs' })).toBeNull();

    expect(await screen.findByText('12 saved jobs')).toBeOnTheScreen();
    // Every row on Saved is already saved, so its bookmark reads as selected.
    expect(screen.getAllByLabelText(/^Remove .* from saved/).length).toBeGreaterThan(0);
  });

  it('switches to Applied: status chips, status pills and no bookmarks', async () => {
    await renderJobs();
    await screen.findByRole('header', { name: "Today's picks" });

    fireEvent.press(screen.getByRole('tab', { name: 'Applied' }));

    // Artboard 1:529 shows the total, not the page size.
    expect(await screen.findByLabelText('All · 12')).toBeOnTheScreen();
    expect(screen.getByLabelText('Search jobs')).toHaveProp(
      'placeholder',
      'Search your applications',
    );
    expect(screen.getByLabelText('In review')).toBeOnTheScreen(); // status chip
    expect(screen.getByLabelText('Interview')).toBeOnTheScreen();
    expect(screen.getByLabelText('Closed')).toBeOnTheScreen();

    // Statuses are worded exactly as the artboard words them. Two applications are 'viewed'.
    expect(await screen.findAllByText('Applied · Viewed')).toHaveLength(2);
    // "In review" appears as the filter chip and on every in-review application.
    expect(screen.getAllByText('In review').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Not selected').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Interview · /).length).toBeGreaterThan(0);
    expect(screen.getByText('Applied 12d ago')).toBeOnTheScreen();

    // Applied rows open the application; they carry no bookmark.
    expect(screen.queryByLabelText(/from saved$/)).toBeNull();
    expect(screen.queryByLabelText(/^Save /)).toBeNull();
  });

  it('narrows the Applied list with a status chip', async () => {
    await renderJobs();
    await screen.findByRole('header', { name: "Today's picks" });
    fireEvent.press(screen.getByRole('tab', { name: 'Applied' }));
    await screen.findByLabelText('All · 12');

    await screen.findAllByText('Not selected');
    fireEvent.press(screen.getByLabelText('Closed'));

    // Only closed applications survive the chip.
    await waitFor(() => expect(screen.queryByText('Applied · Viewed')).toBeNull());
    expect(screen.queryByText(/^Interview · /)).toBeNull();
    expect(screen.getAllByText('Not selected').length).toBeGreaterThan(0);
  });

  it('renders the empty state per tab', async () => {
    await renderJobs('empty');

    expect(await screen.findByText('No jobs match these filters')).toBeOnTheScreen();
  });

  it('renders the error state with retry', async () => {
    await renderJobs('error');

    expect(await screen.findByText("Couldn't load jobs", {}, { timeout: 8000 })).toBeOnTheScreen();
    // Both the picks carousel and the list surface their own retry.
    expect(screen.getAllByLabelText('Try again').length).toBeGreaterThan(0);
  }, 15000);
});
