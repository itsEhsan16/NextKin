import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { jobsFixture, useMockModeStore } from '@/data/mock';
import type { Job } from '@/data/models';
import { createQueryClient, qk, useJob, useSavedJobs, useToggleSaveJob } from '@/data/queries';
import { mockStore, resetMockRepos } from '@/data/repos';

const JOB_ID = 'job_1';

const fixtureJob = (id: string): Job => {
  const job = jobsFixture.find((item) => item.id === id);
  if (!job) throw new Error(`fixture ${id} missing`);
  return { ...job };
};

const repoJobSaved = (id: string) => mockStore.state.jobs.find((job) => job.id === id)?.isSaved;

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
    () => ({ toggle: useToggleSaveJob(), job: useJob(JOB_ID), saved: useSavedJobs() }),
    { wrapper },
  );
}

describe('useToggleSaveJob', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.useFakeTimers();
    useMockModeStore.setState({ mode: 'normal' });
    resetMockRepos();
    queryClient = createQueryClient();
    // Seed caches so the hooks render with data immediately (no initial fetch needed).
    queryClient.setQueryData(qk.jobs.detail(JOB_ID), fixtureJob(JOB_ID));
    queryClient.setQueryData(
      qk.jobs.saved(),
      jobsFixture.filter((job) => job.isSaved),
    );
  });

  afterEach(async () => {
    // Unmount while fake timers are still active and before the client is cleared; otherwise
    // RNTL's root-level auto-cleanup unmounts later and schedules real 5-minute gc timers.
    await cleanup();
    queryClient.clear();
    jest.useRealTimers();
  });

  it('optimistically flips isSaved in detail and saved caches before the request settles', async () => {
    const { result } = await setup(queryClient);
    expect(result.current?.job.data?.isSaved).toBe(false);

    await mutateOptimistically(() => result.current?.toggle.mutate(JOB_ID));

    expect(result.current?.toggle.isPending).toBe(true);
    expect(queryClient.getQueryData<Job>(qk.jobs.detail(JOB_ID))?.isSaved).toBe(true);
    expect(result.current?.job.data?.isSaved).toBe(true);
    expect(result.current?.saved.data?.map((job) => job.id)).toContain(JOB_ID);
    // Repo has not been told yet.
    expect(repoJobSaved(JOB_ID)).toBe(false);
  });

  it('keeps the optimistic value once the request succeeds', async () => {
    const { result } = await setup(queryClient);

    await mutateOptimistically(() => result.current?.toggle.mutate(JOB_ID));
    await waitFor(() => expect(result.current?.toggle.isSuccess).toBe(true), { timeout: 3000 });

    expect(result.current?.job.data?.isSaved).toBe(true);
    expect(repoJobSaved(JOB_ID)).toBe(true);
  });

  it('rolls back every cache when the request fails', async () => {
    useMockModeStore.setState({ mode: 'error' });
    const { result } = await setup(queryClient);
    const savedBefore = queryClient.getQueryData<Job[]>(qk.jobs.saved());

    await mutateOptimistically(() => result.current?.toggle.mutate(JOB_ID));
    expect(result.current?.job.data?.isSaved).toBe(true);

    await waitFor(() => expect(result.current?.toggle.isError).toBe(true), { timeout: 3000 });

    expect(result.current?.job.data?.isSaved).toBe(false);
    expect(queryClient.getQueryData<Job[]>(qk.jobs.saved())).toEqual(savedBefore);
    expect(repoJobSaved(JOB_ID)).toBe(false);
  });

  it('removes an already-saved job from the saved list optimistically', async () => {
    const savedId = 'job_2';
    queryClient.setQueryData(qk.jobs.detail(savedId), fixtureJob(savedId));
    const { result } = await setup(queryClient);

    await mutateOptimistically(() => result.current?.toggle.mutate(savedId));

    expect(result.current?.saved.data?.map((job) => job.id)).not.toContain(savedId);
    expect(queryClient.getQueryData<Job>(qk.jobs.detail(savedId))?.isSaved).toBe(false);
  });
});
