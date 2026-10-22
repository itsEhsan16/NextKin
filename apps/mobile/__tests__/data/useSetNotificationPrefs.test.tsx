import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { notificationPrefsFixture, useMockModeStore } from '@/data/mock';
import type { NotificationPrefs } from '@/data/models';
import { createQueryClient, qk, useSetNotificationPrefs } from '@/data/queries';
import { resetMockRepos } from '@/data/repos';

/** Long enough for two queued writes at the mock's slowest normal latency. */
const BOTH_WRITES_MS = 2_500;

function setup(queryClient: QueryClient) {
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useSetNotificationPrefs(), { wrapper });
}

describe('useSetNotificationPrefs', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.useFakeTimers();
    useMockModeStore.setState({ mode: 'normal' });
    resetMockRepos();
    queryClient = createQueryClient();
    queryClient.setQueryData(qk.notifications.prefs(), notificationPrefsFixture);
  });

  afterEach(async () => {
    await cleanup();
    queryClient.clear();
    jest.useRealTimers();
  });

  it('refetches once after two quick flips, so the second switch never bounces back', async () => {
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = await setup(queryClient);
    const first: NotificationPrefs = { ...notificationPrefsFixture, quietHours: true };
    const second: NotificationPrefs = { ...first, weeklyDigest: !first.weeklyDigest };

    await act(async () => {
      result.current?.mutate(first);
      result.current?.mutate(second);
      await jest.advanceTimersByTimeAsync(1);
    });
    // Both flips show at once, before either has saved.
    expect(queryClient.getQueryData(qk.notifications.prefs())).toEqual(second);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(BOTH_WRITES_MS);
    });

    const prefsRefetches = invalidate.mock.calls.filter(
      ([filters]) => JSON.stringify(filters?.queryKey) === JSON.stringify(qk.notifications.prefs()),
    );
    expect(prefsRefetches).toHaveLength(1);
  });
});
