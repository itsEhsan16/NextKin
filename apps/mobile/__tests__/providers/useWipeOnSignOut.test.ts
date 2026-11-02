import type { QueryClient } from '@tanstack/react-query';
import { act, cleanup, renderHook } from '@testing-library/react-native';

import { qk } from '@nextkin/shared/queries';

import { clearOldResumeCopy, createAppQueryClient } from '@/data/savedResumes';
import { useSessionStore } from '@/features/auth';
import { useWipeOnSignOut } from '@/providers/useWipeOnSignOut';

const mockStore = new Map<string, string>();

jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItemSync: (key: string) => mockStore.get(key) ?? null,
    setItemSync: (key: string, value: string) => void mockStore.set(key, value),
    removeItemSync: (key: string) => void mockStore.delete(key),
  },
}));

const RESUME = { id: 'res_1', title: 'Stripe resume' };

describe('nothing of a resume stays behind (toreview §148.1)', () => {
  let client: QueryClient;

  beforeEach(() => {
    mockStore.clear();
    client = createAppQueryClient();
  });

  afterEach(async () => {
    await cleanup();
    client.clear();
    useSessionStore.setState({ status: 'signed_out' });
  });

  it('wipes memory on a sign-out, and when the account is deleted', async () => {
    useSessionStore.setState({ status: 'signed_in' });
    await renderHook(() => useWipeOnSignOut(client));
    client.setQueryData(qk.resumes.list(), [RESUME]);
    await act(async () => useSessionStore.getState().signOut());
    expect(client.getQueryData(qk.resumes.list())).toBeUndefined();

    useSessionStore.setState({ status: 'signed_in' });
    client.setQueryData(qk.resumes.list(), [RESUME]);
    await act(async () => useSessionStore.getState().deleteAccount());
    expect(client.getQueryData(qk.resumes.list())).toBeUndefined();
  });

  it('keeps memory while signed in', async () => {
    useSessionStore.setState({ status: 'signed_in' });
    await renderHook(() => useWipeOnSignOut(client));
    client.setQueryData(qk.resumes.list(), [RESUME]);
    expect(client.getQueryData(qk.resumes.list())).toEqual([RESUME]);
  });

  it('removes the copy an earlier build saved on the phone', () => {
    mockStore.set('offline.resumes', 'left behind');
    clearOldResumeCopy();
    expect(mockStore.has('offline.resumes')).toBe(false);
  });
});
