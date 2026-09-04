import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { resetMockRepos } from '@/data/repos';
import { NotificationsScreen, useNotificationsStore } from '@/features/notifications';

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

const INITIAL = useNotificationsStore.getState();

/** One mount per file — see the test-infra note in the plan's Phase 5 status. */
describe('Notifications first use (NOTIF 06 — 1:2788)', () => {
  beforeEach(() => {
    resetMockRepos();
    mockPush.mockClear();
    useNotificationsStore.setState(INITIAL, true);
  });

  afterEach(async () => {
    await Promise.all(clients.map((client) => client.cancelQueries()));
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
  });

  it('explains what arrives before anything ever has', async () => {
    useMockModeStore.setState({ mode: 'empty' });
    const queryClient = createQueryClient();
    clients.push(queryClient);
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <QueryClientProvider client={queryClient}>
          <NotificationsScreen />
        </QueryClientProvider>
      </SafeAreaProvider>,
    );

    expect(await screen.findByText('Nothing here yet', {}, { timeout: 10000 })).toBeOnTheScreen();
    expect(screen.getByText('This is what NextKin will tell you about:')).toBeOnTheScreen();

    // The four "what arrives" rows, NOTIF 04's categories in preview form.
    expect(screen.getByLabelText('New matches: One batch a day, refreshed each morning')).toBeOnTheScreen();
    expect(screen.getByLabelText('Saved jobs closing: 48 hours before the deadline')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Application updates: Viewed, stage changes, decisions'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('AI results: Scores, cover letters, tailored drafts')).toBeOnTheScreen();
    expect(screen.getByText('We only send what you switch on.')).toBeOnTheScreen();

    // First use drops the meta row and the pills — only the title row survives.
    expect(screen.queryByText(/\d unread/)).toBeNull();
    expect(screen.queryByLabelText('Applications')).toBeNull();

    fireEvent.press(screen.getByLabelText('Choose what you get notified about'));
    expect(mockPush).toHaveBeenCalledWith('/notifications/preferences');
  }, 30000);
});
