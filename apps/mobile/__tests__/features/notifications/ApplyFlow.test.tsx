import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { mockStore, resetMockRepos } from '@/data/repos';
import { JobDetailScreen } from '@/features/jobs';
import { useNotificationsStore } from '@/features/notifications';

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

/**
 * NOTIF 07 — the post-apply flow over Job Detail: real submission, the confirmation toast,
 * and the contextual push primer (permission mocked to "never asked" in jest.setup).
 * ONE mount for the walk — see the test-infra note in the plan's Phase 5 status.
 */
describe('Apply flow with push primer (NOTIF 07 — 1:2928)', () => {
  beforeEach(() => {
    resetMockRepos();
    mockPush.mockClear();
    (Notifications.requestPermissionsAsync as jest.Mock).mockClear();
    useNotificationsStore.setState(INITIAL, true);
  });

  afterEach(async () => {
    await Promise.all(clients.map((client) => client.cancelQueries()));
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
  });

  it('applies for real, confirms with the toast, and asks contextually — once per apply', async () => {
    const queryClient = createQueryClient();
    clients.push(queryClient);
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <QueryClientProvider client={queryClient}>
          <JobDetailScreen id="job_razorpay" />
        </QueryClientProvider>
      </SafeAreaProvider>,
    );

    expect(await screen.findByText('Senior UX Designer', {}, { timeout: 10000 })).toBeOnTheScreen();
    // The OS dialog must NOT have fired from the screen appearing (note 1:2939).
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();

    // — Apply: the Applied tab's data gains the row and the toast confirms —
    fireEvent.press(screen.getByLabelText('Apply now'));
    // Repo first: it observes the mutation without depending on a React commit.
    await waitFor(
      () =>
        expect(mockStore.state.applications.some((app) => app.jobId === 'job_razorpay')).toBe(true),
      { timeout: 10000 },
    );
    await waitFor(() => expect(useNotificationsStore.getState().primerOpen).toBe(true), {
      timeout: 10000,
    });

    // — The primer rides in because permission was never asked —
    expect(
      await screen.findByText('Get notified when Razorpay responds', {}, { timeout: 10000 }),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        "We'll tell you when your application is viewed, changes stage, or gets a decision. Nothing else.",
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText('You can change this any time in Profile › Notifications')).toBeOnTheScreen();
    // The toast sits OUTSIDE the primer sheet, and the sheet's accessibilityViewIsModal hides
    // its siblings from default queries — exactly what a screen reader would experience.
    expect(
      screen.getByText('Application sent to Razorpay', { includeHiddenElements: true }),
    ).toBeOnTheScreen();

    // "Turn on notifications" is the ONLY thing that fires the OS dialog.
    fireEvent.press(screen.getByLabelText('Turn on notifications'));
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(useNotificationsStore.getState().primerOpen).toBe(false);

    // — Re-applying is idempotent, and "Not now" costs nothing —
    fireEvent.press(await screen.findByLabelText('Apply now', {}, { timeout: 5000 }));
    expect(
      await screen.findByText('Get notified when Razorpay responds', {}, { timeout: 10000 }),
    ).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText('Not now'));
    expect(useNotificationsStore.getState().primerOpen).toBe(false);
    expect(
      mockStore.state.applications.filter((app) => app.jobId === 'job_razorpay'),
    ).toHaveLength(1);
    // No extra OS ask from "Not now".
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  }, 90000);
});
