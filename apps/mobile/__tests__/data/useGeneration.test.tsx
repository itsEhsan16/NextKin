import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { ACTIVE_GENERATION_ID, useMockModeStore } from '@/data/mock';
import type { Generation } from '@/data/models';
import { createQueryClient, qk, useGeneration, useStartGeneration } from '@/data/queries';
import { GENERATION_TICK_MS, mockStore, resetMockRepos } from '@/data/repos';

const DONE_ID = 'gen_done_1';

/**
 * V2 §7.6 — the query layer over the generation pipeline.
 *
 * The hooks read the `repos` singleton, so the singleton is what these tests drive. A ticker is
 * a `setInterval` closed over the repo instance and `resetMockRepos()` re-seeds the state
 * underneath a still-running one (see `generationsRepo`'s header), so every run is stopped with
 * `jest.clearAllTimers()` on teardown before the next test's reset.
 */

/** Every client built in this file, so teardown can clear them all after the trees unmount. */
const clients: QueryClient[] = [];

function newClient(): QueryClient {
  const client = createQueryClient();
  clients.push(client);
  return client;
}

function wrap(queryClient: QueryClient) {
  const Wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return Wrapper;
}

const storedGeneration = (id: string): Generation | undefined =>
  mockStore.state.generations.find((generation) => generation.id === id);

/** A copy of a seeded run, so the cache does not alias the row the ticker rewrites. */
const fixtureGeneration = (id: string): Generation => {
  const generation = storedGeneration(id);
  if (!generation) throw new Error(`fixture ${id} missing`);
  return { ...generation };
};

describe('useGeneration', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useMockModeStore.setState({ mode: 'normal' });
    resetMockRepos();
  });

  afterEach(async () => {
    // Unmount while fake timers are still active and before the clients are cleared; a late
    // React Query update arriving during teardown wedges React's act queue.
    await cleanup();
    clients.forEach((client) => client.clear());
    clients.length = 0;
    // Tickers outlive `resetMockRepos()`, so kill them before the next test re-seeds the store.
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('seeds the started run into detail and active, and stales the usage banner', async () => {
    const queryClient = newClient();
    queryClient.setQueryData(qk.user.subscription(), mockStore.state.subscription);

    const { result } = await renderHook(() => useStartGeneration(), {
      wrapper: wrap(queryClient),
    });

    await act(async () => {
      result.current?.mutate({ kind: 'resume', jobId: 'job_stripe' });
      await jest.advanceTimersByTimeAsync(3000);
    });
    await waitFor(() => expect(result.current?.isSuccess).toBe(true), { timeout: 3000 });

    const started = result.current?.data;
    expect(started?.status).toBe('queued');
    const id = started?.id ?? '';
    expect(id).not.toBe('');
    // The progress screen this navigates to renders from cache, not from a fresh fetch.
    expect(queryClient.getQueryData<Generation>(qk.generations.detail(id))?.id).toBe(id);
    // Home's progress card reads the active key, so it has to see the new run too.
    expect(queryClient.getQueryData<Generation>(qk.generations.active())?.id).toBe(id);
    // §13.3's usage banner shows the spend before the run finishes.
    expect(queryClient.getQueryState(qk.user.subscription())?.isInvalidated).toBe(true);
  });

  it('follows a live run to ready and keeps the active card in step', async () => {
    const queryClient = newClient();
    queryClient.setQueryData(
      qk.generations.detail(ACTIVE_GENERATION_ID),
      fixtureGeneration(ACTIVE_GENERATION_ID),
    );

    const { result } = await renderHook(() => useGeneration(ACTIVE_GENERATION_ID), {
      wrapper: wrap(queryClient),
    });
    expect(result.current?.data?.status).toBe('generating');

    // 0.45 → 1 in steps of 0.15: four ticks, plus one more to prove the ticker stopped.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(GENERATION_TICK_MS * 5);
    });

    expect(result.current?.data?.status).toBe('ready');
    expect(result.current?.data?.progress).toBe(1);
    expect(queryClient.getQueryData<Generation>(qk.generations.active())?.status).toBe('ready');
    expect(storedGeneration(ACTIVE_GENERATION_ID)?.status).toBe('ready');
  });

  it('tears the subscription down on unmount, freezing the run', async () => {
    const queryClient = newClient();
    queryClient.setQueryData(
      qk.generations.detail(ACTIVE_GENERATION_ID),
      fixtureGeneration(ACTIVE_GENERATION_ID),
    );

    const { unmount } = await renderHook(() => useGeneration(ACTIVE_GENERATION_ID), {
      wrapper: wrap(queryClient),
    });

    await act(async () => {
      await jest.advanceTimersByTimeAsync(GENERATION_TICK_MS);
    });
    const afterOneTick = storedGeneration(ACTIVE_GENERATION_ID)?.progress;
    expect(afterOneTick).toBeCloseTo(0.6);

    await act(async () => {
      unmount();
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(GENERATION_TICK_MS * 4);
    });

    // The last listener left, so the interval was cleared: no further ticks landed.
    expect(storedGeneration(ACTIVE_GENERATION_ID)?.progress).toBe(afterOneTick);
  });

  it('never subscribes to a run that already finished', async () => {
    const queryClient = newClient();
    queryClient.setQueryData(qk.generations.detail(DONE_ID), fixtureGeneration(DONE_ID));

    const { result } = await renderHook(() => useGeneration(DONE_ID), {
      wrapper: wrap(queryClient),
    });
    expect(result.current?.data?.status).toBe('ready');

    await act(async () => {
      await jest.advanceTimersByTimeAsync(GENERATION_TICK_MS * 3);
    });

    expect(storedGeneration(DONE_ID)?.progress).toBe(1);
    // A terminal run is nobody's active run: the effect never wrote the key.
    expect(queryClient.getQueryData<Generation>(qk.generations.active())).toBeUndefined();
  });
});
