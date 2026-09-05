import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { profileFixture, useMockModeStore } from '@/data/mock';
import type { Experience, Profile } from '@/data/models';
import {
  createQueryClient,
  qk,
  useProfile,
  useRemoveExperience,
  useUpsertExperience,
} from '@/data/queries';
import { mockStore, resetMockRepos } from '@/data/repos';

/** A blank id is what the "Add role" form sends — the repo assigns the real one. */
const NEW_ROLE: Experience = {
  id: '',
  company: 'Zerodha',
  title: 'Staff Product Designer',
  startDate: '2024-04-01',
  current: true,
  skills: ['Design systems', 'Fintech'],
};

const EXISTING_ID = 'exp_2';

const cachedProfile = (queryClient: QueryClient): Profile | undefined =>
  queryClient.getQueryData<Profile>(qk.profile.me());

const repoProfile = (): Profile => mockStore.state.profile;

const titles = (profile: Profile | undefined): string[] =>
  profile?.experiences.map((entry) => entry.title) ?? [];

const ids = (profile: Profile | undefined): string[] =>
  profile?.experiences.map((entry) => entry.id) ?? [];

/**
 * Fires the mutation and flushes React Query's batched notifications (a setTimeout(0)
 * under the hood) without reaching the 300ms+ mock latency, so the optimistic state is
 * observable while the request is still in flight.
 */
async function mutateOptimistically(fn: () => void) {
  await act(async () => {
    fn();
    await jest.advanceTimersByTimeAsync(1);
  });
}

/** RNTL 14: renderHook/act are async. */
function setup(queryClient: QueryClient) {
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(
    () => ({
      profile: useProfile(),
      upsert: useUpsertExperience(),
      remove: useRemoveExperience(),
    }),
    { wrapper },
  );
}

describe('useProfileEntries', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.useFakeTimers();
    useMockModeStore.setState({ mode: 'normal' });
    resetMockRepos();
    queryClient = createQueryClient();
    // Seed the cache so the hooks render with data immediately (no initial fetch needed).
    queryClient.setQueryData(qk.profile.me(), { ...profileFixture });
  });

  afterEach(async () => {
    // Unmount while fake timers are still active and before the client is cleared; otherwise
    // RNTL's root-level auto-cleanup unmounts later and schedules real 5-minute gc timers.
    await cleanup();
    queryClient.clear();
    jest.useRealTimers();
  });

  it('shows an upserted role in the profile cache before the request settles', async () => {
    const { result } = await setup(queryClient);
    expect(titles(result.current?.profile.data)).not.toContain(NEW_ROLE.title);

    await mutateOptimistically(() => result.current?.upsert.mutate(NEW_ROLE));

    expect(result.current?.upsert.isPending).toBe(true);
    expect(titles(cachedProfile(queryClient))).toContain(NEW_ROLE.title);
    expect(result.current?.profile.data?.experiences).toHaveLength(
      profileFixture.experiences.length + 1,
    );
    // Repo has not been told yet.
    expect(titles(repoProfile())).not.toContain(NEW_ROLE.title);
  });

  it('keeps the role and takes the server completeness once the request succeeds', async () => {
    const { result } = await setup(queryClient);

    await mutateOptimistically(() => result.current?.upsert.mutate(NEW_ROLE));
    await waitFor(() => expect(result.current?.upsert.isSuccess).toBe(true), { timeout: 5000 });

    expect(titles(repoProfile())).toContain(NEW_ROLE.title);
    expect(titles(cachedProfile(queryClient))).toContain(NEW_ROLE.title);
    expect(cachedProfile(queryClient)?.completeness).toBe(repoProfile().completeness);
  });

  it('rolls the profile back when the request fails', async () => {
    useMockModeStore.setState({ mode: 'error' });
    const { result } = await setup(queryClient);
    const before = cachedProfile(queryClient);

    await mutateOptimistically(() => result.current?.upsert.mutate(NEW_ROLE));
    expect(titles(result.current?.profile.data)).toContain(NEW_ROLE.title);

    await waitFor(() => expect(result.current?.upsert.isError).toBe(true), { timeout: 5000 });

    expect(cachedProfile(queryClient)).toEqual(before);
    expect(titles(result.current?.profile.data)).not.toContain(NEW_ROLE.title);
  });

  it('removes a role optimistically and settles on the repo completeness', async () => {
    const { result } = await setup(queryClient);

    await mutateOptimistically(() => result.current?.remove.mutate(EXISTING_ID));

    expect(result.current?.remove.isPending).toBe(true);
    expect(ids(result.current?.profile.data)).not.toContain(EXISTING_ID);
    // The optimistic write never guesses the meter — only the server moves it.
    expect(cachedProfile(queryClient)?.completeness).toBe(profileFixture.completeness);

    await waitFor(() => expect(result.current?.remove.isSuccess).toBe(true), { timeout: 5000 });

    expect(ids(cachedProfile(queryClient))).not.toContain(EXISTING_ID);
    expect(ids(repoProfile())).not.toContain(EXISTING_ID);
    expect(cachedProfile(queryClient)?.completeness).toBe(repoProfile().completeness);
    expect(cachedProfile(queryClient)?.completeness).not.toBe(profileFixture.completeness);
  });
});
