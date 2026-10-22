import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { resetMockRepos } from '@/data/repos';
import { HistoryScreen, useHistoryStore } from '@/features/history';

const mockNavigate = jest.fn();
const mockBack = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    navigate: mockNavigate,
    back: mockBack,
    replace: jest.fn(),
  }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const INITIAL = useHistoryStore.getState();

/** ONE mount for the whole walk — see the test-infra note in the plan's Phase 5 status. */
describe('History feed (the audit trail, phase 9I)', () => {
  beforeEach(() => {
    resetMockRepos();
    mockNavigate.mockClear();
    mockBack.mockClear();
    useHistoryStore.setState(INITIAL, true);
  });

  afterEach(async () => {
    await Promise.all(clients.map((client) => client.cancelQueries()));
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
  });

  it('groups by age, filters by pill, and opens a row at its real route with navigate', async () => {
    const queryClient = createQueryClient();
    clients.push(queryClient);
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <QueryClientProvider client={queryClient}>
          <HistoryScreen />
        </QueryClientProvider>
      </SafeAreaProvider>,
    );

    // FlashList is a virtualised FlatList under Jest, so only the first window of the 25 rows is
    // mounted: the assertions below are about what that window guarantees. EARLIER, the last
    // group, is asserted through the grouping's own unit test instead.
    expect(
      await screen.findByRole('header', { name: 'Today' }, { timeout: 10000 }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'This week' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'History' })).toBeOnTheScreen();

    // — The newest row is a generation; opening it navigates (never pushes) to its document —
    const newest = screen.getAllByLabelText(/^Generation, /)[0];
    if (!newest) throw new Error('no generation row in the first window');
    await act(async () => fireEvent.press(newest));
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate.mock.calls[0]?.[0]).toMatch(/^\/resumes\//);

    // — Account is three rows, so it renders whole: the pill narrows to exactly those —
    await act(async () => fireEvent.press(screen.getByLabelText('Account')));
    expect(screen.getAllByLabelText(/^(Profile|Plan & billing), /)).toHaveLength(3);
    expect(screen.queryByLabelText(/^Generation, /)).toBeNull();
    expect(useHistoryStore.getState().filter).toBe('account');

    // — And back to everything —
    await act(async () => fireEvent.press(screen.getByLabelText('All')));
    expect(screen.getAllByLabelText(/^Generation, /).length).toBeGreaterThan(0);

    fireEvent.press(screen.getByLabelText('Back'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  }, 60000);
});
