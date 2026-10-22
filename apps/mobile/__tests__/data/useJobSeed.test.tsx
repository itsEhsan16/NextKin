import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { jobsFixture, useMockModeStore } from '@/data/mock';
import { createQueryClient, qk, useJob } from '@/data/queries';
import { resetMockRepos } from '@/data/repos';

const JOB_ID = 'job_1';

function setup(queryClient: QueryClient, seedFromLists: boolean) {
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useJob(JOB_ID, { seedFromLists }), { wrapper });
}

describe('useJob seedFromLists', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.useFakeTimers();
    useMockModeStore.setState({ mode: 'normal' });
    resetMockRepos();
    queryClient = createQueryClient();
    // A job the user can see in Today's picks, with no detail entry cached yet.
    queryClient.setQueryData(
      qk.jobs.picks(),
      jobsFixture.filter((job) => job.id === JOB_ID),
    );
  });

  afterEach(async () => {
    await cleanup();
    queryClient.clear();
    jest.useRealTimers();
  });

  it("paints the list's copy at once instead of a skeleton", async () => {
    const { result } = await setup(queryClient, true);

    expect(result.current?.isPending).toBe(false);
    expect(result.current?.isPlaceholderData).toBe(true);
    expect(result.current?.data?.id).toBe(JOB_ID);
  });

  it('leaves screens that did not opt in on their own load', async () => {
    const { result } = await setup(queryClient, false);

    expect(result.current?.isPending).toBe(true);
    expect(result.current?.data).toBeUndefined();
  });
});
