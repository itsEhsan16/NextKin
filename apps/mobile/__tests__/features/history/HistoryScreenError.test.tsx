import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore, type MockMode } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { resetMockRepos } from '@/data/repos';
import { HistoryScreen, useHistoryStore } from '@/features/history';

const mockNavigate = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    navigate: mockNavigate,
    back: jest.fn(),
    replace: jest.fn(),
  }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const INITIAL = useHistoryStore.getState();

async function mount(mode: MockMode) {
  useMockModeStore.setState({ mode });
  const queryClient = createQueryClient();
  clients.push(queryClient);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>
        <HistoryScreen />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

/**
 * The two states where there is nothing to list are different sentences: a failure the reader
 * can retry, and an account that has simply done nothing yet, which retry would not change.
 */
describe('History — error and first-use states', () => {
  beforeEach(() => {
    resetMockRepos();
    mockNavigate.mockClear();
    useHistoryStore.setState(INITIAL, true);
  });

  afterEach(async () => {
    await Promise.all(clients.map((client) => client.cancelQueries()));
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
  });

  it('offers a retry when the trail could not be read', async () => {
    await mount('error');
    expect(
      await screen.findByText("Couldn't load your history", {}, { timeout: 15000 }),
    ).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByLabelText('Try again')));
    // `waitFor` around the assertion: the retry passes back through the skeleton first.
    await waitFor(() => expect(screen.getByText("Couldn't load your history")).toBeOnTheScreen(), {
      timeout: 15000,
    });
  }, 60000);

  it('sends an account with no history toward its first job, with no pills to filter nothing', async () => {
    await mount('empty');
    expect(await screen.findByText('Nothing here yet', {}, { timeout: 15000 })).toBeOnTheScreen();
    expect(screen.queryByLabelText('Jobs')).toBeNull();
    await act(async () => fireEvent.press(screen.getByLabelText('Find jobs')));
    expect(mockNavigate).toHaveBeenCalledWith('/jobs');
  }, 60000);
});
