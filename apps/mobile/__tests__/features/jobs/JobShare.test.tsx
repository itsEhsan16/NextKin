import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { resetMockRepos } from '@/data/repos';
import { JobDetailScreen, useJobsStore } from '@/features/jobs';
import { JOB_LINK_COPIED, JOB_SHARE_UNAVAILABLE } from '@/features/jobs/hooks/useJobsActions';

/** Only the two native side effects are stubbed; everything else in @/lib stays real. */
jest.mock('@/lib', () => ({
  ...jest.requireActual('@/lib'),
  shareText: jest.fn(),
  copyToClipboard: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const lib = require('@/lib') as { shareText: jest.Mock; copyToClipboard: jest.Mock };

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const clients: QueryClient[] = [];
const INITIAL = useJobsStore.getState();

/**
 * The share fallback (9H's `job-share`). `JobsToastHost` shipped in 9H and was mounted nowhere,
 * so this whole path was a silent tap until the job detail screen started hosting it — which is
 * why this suite exists: it asserts on what the READER sees, not on the store.
 */
describe('Share this job — the fallback when no OS sheet answers', () => {
  beforeEach(() => {
    resetMockRepos();
    useJobsStore.setState(INITIAL, true);
    lib.shareText.mockReset();
    lib.copyToClipboard.mockReset();
  });

  afterEach(async () => {
    await Promise.all(clients.map((client) => client.cancelQueries()));
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
    useJobsStore.setState(INITIAL, true);
  });

  it('says the job went to the clipboard, or that nothing on the device could take it', async () => {
    lib.shareText.mockResolvedValue('unavailable');
    lib.copyToClipboard.mockResolvedValue('done');

    const queryClient = createQueryClient();
    clients.push(queryClient);
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <QueryClientProvider client={queryClient}>
          <JobDetailScreen id="job_stripe" />
        </QueryClientProvider>
      </SafeAreaProvider>,
    );
    await screen.findByLabelText('Share this job', {}, { timeout: 10000 });

    await act(async () => fireEvent.press(screen.getByLabelText('Share this job')));
    await waitFor(() => expect(screen.getByText(JOB_LINK_COPIED)).toBeOnTheScreen(), {
      timeout: 10000,
    });
    // What was shared names the role and company; it deliberately carries no link — `Job` has
    // no listing URL, and a share that opened the company homepage would read as the posting.
    const shared = lib.shareText.mock.calls[0]?.[0] as string;
    expect(shared).toContain('Senior Product Designer');
    expect(shared).toContain('Stripe');
    expect(shared).not.toMatch(/https?:\/\//);

    // — Neither the sheet nor the clipboard: a different sentence, still on screen —
    await act(async () => useJobsStore.getState().hideToast());
    lib.copyToClipboard.mockResolvedValue('unavailable');
    await act(async () => fireEvent.press(screen.getByLabelText('Share this job')));
    await waitFor(() => expect(screen.getByText(JOB_SHARE_UNAVAILABLE)).toBeOnTheScreen(), {
      timeout: 10000,
    });

    // — A sheet that answered needs no toast at all —
    await act(async () => useJobsStore.getState().hideToast());
    lib.shareText.mockResolvedValue('done');
    await act(async () => fireEvent.press(screen.getByLabelText('Share this job')));
    await act(async () => {});
    expect(screen.queryByText(JOB_LINK_COPIED)).toBeNull();
    expect(screen.queryByText(JOB_SHARE_UNAVAILABLE)).toBeNull();
  }, 60000);
});
