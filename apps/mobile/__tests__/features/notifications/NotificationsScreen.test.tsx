import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { mockStore, resetMockRepos } from '@/data/repos';
import { NotificationsScreen, useNotificationsStore } from '@/features/notifications';

const mockPush = jest.fn();
const mockNavigate = jest.fn();
const mockBack = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, navigate: mockNavigate, back: mockBack }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const INITIAL = useNotificationsStore.getState();

/** ONE mount for the whole walk — see the test-infra note in the plan's Phase 5 status. */
describe('Notifications feed (NOTIF 01/02/03/05)', () => {
  beforeEach(() => {
    resetMockRepos();
    mockPush.mockClear();
    mockNavigate.mockClear();
    useNotificationsStore.setState(INITIAL, true);
  });

  afterEach(async () => {
    await Promise.all(clients.map((client) => client.cancelQueries()));
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
  });

  it('walks the chrome, the groups, deep links, the row menu and the caught-up state', async () => {
    useMockModeStore.setState({ mode: 'normal' });
    const queryClient = createQueryClient();
    clients.push(queryClient);
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <QueryClientProvider client={queryClient}>
          <NotificationsScreen />
        </QueryClientProvider>
      </SafeAreaProvider>,
    );

    // — Chrome and the artboard copy —
    expect(await screen.findByText('Show all', {}, { timeout: 10000 })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Notifications' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Back')).toBeOnTheScreen();
    expect(screen.getByLabelText('Notification preferences')).toBeOnTheScreen();
    expect(screen.getByText('4 unread')).toBeOnTheScreen();
    expect(screen.getByLabelText('Mark all read')).toBeOnTheScreen();
    for (const pill of ['All', 'Jobs', 'Applications', 'Account']) {
      expect(screen.getByLabelText(pill)).toBeOnTheScreen();
    }
    expect(screen.getByLabelText('All')).toBeSelected();

    // — Group headers (calendar-based; the fixture spans all three) —
    expect(screen.getByRole('header', { name: 'TODAY' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'THIS WEEK' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'EARLIER' })).toBeOnTheScreen();

    // — Rich rows render their full line (bold runs and all) —
    expect(screen.getByText('5 new matches for Senior Product Designer')).toBeOnTheScreen();
    expect(
      screen.getByText('Your ATS score for Stripe — Senior PD is ready. It scored 88 — two quick wins left.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Manage notification types')).toBeOnTheScreen();

    // — Opening a row deep-links to its exact destination and clears its unread state —
    fireEvent.press(screen.getByLabelText(/^Stripe viewed your application/));
    expect(mockNavigate).toHaveBeenCalledWith('/jobs/job_stripe');
    expect(await screen.findByText('3 unread', {}, { timeout: 10000 })).toBeOnTheScreen();

    // — Filter pills narrow by category group —
    fireEvent.press(screen.getByLabelText('Applications'));
    await waitFor(() =>
      expect(screen.queryByText('5 new matches for Senior Product Designer')).toBeNull(),
    );
    expect(screen.getByLabelText(/^Freshworks moved your application/)).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText('Jobs'));
    await waitFor(() =>
      expect(screen.getByText('5 new matches for Senior Product Designer')).toBeOnTheScreen(),
    );
    expect(screen.queryByLabelText(/^Freshworks moved your application/)).toBeNull();

    fireEvent.press(screen.getByLabelText('All'));
    await screen.findByLabelText(/^Freshworks moved your application/);

    // — Long-press raises the row menu (the same sheet as swipe-More; note 1:2600) —
    fireEvent(screen.getByLabelText(/^Freshworks moved your application/), 'longPress');
    expect(await screen.findByLabelText('Mark as read')).toBeOnTheScreen();
    expect(screen.getByText(/^Application update · /)).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Turn off application updates', { exact: false }),
    ).toBeOnTheScreen();
    expect(screen.getByText('You keep matches, closing alerts and AI results')).toBeOnTheScreen();

    // Muting writes through the prefs repo.
    fireEvent.press(screen.getByLabelText('Turn off application updates', { exact: false }));
    await waitFor(
      () => expect(mockStore.state.notificationPrefs.categories.applications).toBe(false),
      { timeout: 10000 },
    );
    expect(useNotificationsStore.getState().menuOpen).toBe(false);

    // — Mark all read retires the meta row —
    fireEvent.press(screen.getByLabelText('Mark all read'));
    await waitFor(() => expect(screen.queryByText(/\d unread/)).toBeNull(), { timeout: 10000 });

    // — Deleting the only Account row leaves that filter all caught up (NOTIF 05) —
    fireEvent.press(screen.getByLabelText('Account'));
    await screen.findByLabelText(/^Your free plan renews monthly/);
    fireEvent(screen.getByLabelText(/^Your free plan renews monthly/), 'longPress');
    fireEvent.press(await screen.findByLabelText('Delete'));

    expect(await screen.findByText("You're all caught up", {}, { timeout: 10000 })).toBeOnTheScreen();
    expect(
      screen.getByText('New matches, application updates and AI results will land here.'),
    ).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText("Explore today's matches"));
    expect(mockNavigate).toHaveBeenCalledWith('/jobs');

    // — Chrome buttons route —
    fireEvent.press(screen.getByLabelText('Notification preferences'));
    expect(mockPush).toHaveBeenCalledWith('/notifications/preferences');
    fireEvent.press(screen.getByLabelText('Back'));
    expect(mockBack).toHaveBeenCalled();
  }, 90000);
});
