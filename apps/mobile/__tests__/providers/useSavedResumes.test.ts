import type { QueryClient } from '@tanstack/react-query';
import { act, cleanup, renderHook } from '@testing-library/react-native';

import { qk } from '@nextkin/shared/queries';

import { createAppQueryClient } from '@/data/savedResumes';
import { useSessionStore } from '@/features/auth';
import { useSavedResumes } from '@/providers/useSavedResumes';

const mockStore = new Map<string, string>();

jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItemSync: (key: string) => mockStore.get(key) ?? null,
    setItemSync: (key: string, value: string) => void mockStore.set(key, value),
    removeItemSync: (key: string) => void mockStore.delete(key),
  },
}));

const KEY = 'offline.resumes';
const RESUME = { id: 'res_1', title: 'Stripe resume' };

/** Signed in, with a saved copy on the phone and the resume in memory. */
async function savedAndSignedIn(client: QueryClient) {
  useSessionStore.setState({ status: 'signed_in' });
  await renderHook(() => useSavedResumes(client));
  client.setQueryData(qk.resumes.list(), [RESUME]);
  await act(() => jest.advanceTimersByTimeAsync(1000));
  expect(mockStore.has(KEY)).toBe(true);
}

describe('useSavedResumes', () => {
  let client: QueryClient;

  beforeEach(() => {
    jest.useFakeTimers();
    mockStore.clear();
    client = createAppQueryClient();
  });

  afterEach(async () => {
    await cleanup();
    client.clear();
    useSessionStore.setState({ status: 'signed_out' });
    jest.useRealTimers();
  });

  it('wipes the phone on a sign-out', async () => {
    await savedAndSignedIn(client);

    await act(async () => useSessionStore.getState().signOut());
    expect(mockStore.has(KEY)).toBe(false);
    expect(client.getQueryData(qk.resumes.list())).toBeUndefined();
  });

  it('wipes the phone when the account is deleted', async () => {
    await savedAndSignedIn(client);

    await act(async () => useSessionStore.getState().deleteAccount());
    expect(mockStore.has(KEY)).toBe(false);
    expect(client.getQueryData(qk.resumes.list())).toBeUndefined();
  });

  it('wipes a copy left behind by a sign-out that came first', async () => {
    mockStore.set(KEY, 'left behind');
    useSessionStore.setState({ status: 'signed_out' });
    await renderHook(() => useSavedResumes(client));
    expect(mockStore.has(KEY)).toBe(false);
  });

  it('leaves the copy alone while signed in', async () => {
    await savedAndSignedIn(client);
    await cleanup();
    expect(mockStore.has(KEY)).toBe(true);
  });
});
