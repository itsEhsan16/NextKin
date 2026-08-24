import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { mockStore, resetMockRepos } from '@/data/repos';
import { NotificationPreferencesScreen } from '@/features/notifications';

const mockBack = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), back: mockBack }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** One mount per file — see the test-infra note in the plan's Phase 5 status. */
describe('Notification preferences (NOTIF 04 — 1:2711)', () => {
  beforeEach(() => {
    resetMockRepos();
    mockBack.mockClear();
  });

  afterEach(async () => {
    await Promise.all(clients.map((client) => client.cancelQueries()));
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
  });

  it('renders the five categories and two delivery switches, and writes flips through', async () => {
    const queryClient = createQueryClient();
    clients.push(queryClient);
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <QueryClientProvider client={queryClient}>
          <NotificationPreferencesScreen />
        </QueryClientProvider>
      </SafeAreaProvider>,
    );

    expect(
      await screen.findByRole('header', { name: 'Notification preferences' }, { timeout: 10000 }),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Choose what reaches your lock screen. Everything else still appears in the in-app feed.',
      ),
    ).toBeOnTheScreen();

    // — Categories (Figma 1:2717), with the artboard captions —
    expect(await screen.findByText('Job matches', {}, { timeout: 10000 })).toBeOnTheScreen();
    expect(screen.getByText('One batch a day, never more')).toBeOnTheScreen();
    expect(screen.getByText('Saved job closing soon')).toBeOnTheScreen();
    expect(screen.getByText('48 hours before a saved role closes')).toBeOnTheScreen();
    expect(screen.getByText('Application updates')).toBeOnTheScreen();
    expect(screen.getByText('Viewed, moved stage, decision')).toBeOnTheScreen();
    expect(screen.getByText('AI results ready')).toBeOnTheScreen();
    expect(screen.getByText('Scores, cover letters, tailoring')).toBeOnTheScreen();
    expect(screen.getByText('Plan & billing')).toBeOnTheScreen();
    expect(screen.getByText('Renewals, credits, receipts')).toBeOnTheScreen();
    expect(
      screen.getByText('Five categories, deliberately. Nothing else can be turned into a push.'),
    ).toBeOnTheScreen();

    // Switch states mirror the fixture: everything on except Plan & billing.
    expect(screen.getByLabelText('Job matches')).toBeChecked();
    expect(screen.getByLabelText('Plan & billing')).not.toBeChecked();

    // — Delivery (Figma 1:2752) —
    expect(screen.getByText('Quiet hours')).toBeOnTheScreen();
    expect(screen.getByText('10pm – 8am, held until morning')).toBeOnTheScreen();
    expect(screen.getByText('Weekly digest')).toBeOnTheScreen();
    expect(screen.getByText('Anything you missed, Sunday 9am')).toBeOnTheScreen();

    // — The system-permission line reflects the (mocked, never-asked) state —
    expect(
      await screen.findByText(
        "You haven't allowed notifications yet — applying to a job will offer to turn them on.",
      ),
    ).toBeOnTheScreen();

    // — Flips write through the repo —
    fireEvent.press(screen.getByLabelText('Plan & billing'));
    await waitFor(() => expect(mockStore.state.notificationPrefs.categories.billing).toBe(true), {
      timeout: 10000,
    });
    fireEvent.press(screen.getByLabelText('Quiet hours'));
    await waitFor(() => expect(mockStore.state.notificationPrefs.quietHours).toBe(false), {
      timeout: 10000,
    });

    fireEvent.press(screen.getByLabelText('Back'));
    expect(mockBack).toHaveBeenCalled();
  }, 60000);
});
