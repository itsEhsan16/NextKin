import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { mockStore, resetMockRepos } from '@/data/repos';
import { ApplyAskHost, JobDetailScreen } from '@/features/jobs';
import { useApplyAskStore } from '@/features/jobs/applyAskStore';
import {
  APPLY_ASK_NO,
  APPLY_ASK_NOT_YET,
  APPLY_ASK_TITLE,
  APPLY_ASK_YES,
} from '@/features/jobs/components/ApplyAskHost';
import { useAppToast } from '@/ui/Toast';

const mockOpenBrowser = jest.fn(async (_url: string) => ({ type: 'dismiss' }));
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), back: jest.fn() }),
  Link: ({ children }: PropsWithChildren) => children,
}));
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: (url: string) => mockOpenBrowser(url),
  WebBrowserPresentationStyle: { PAGE_SHEET: 'pageSheet' },
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

async function open() {
  const queryClient = createQueryClient();
  clients.push(queryClient);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>
        <JobDetailScreen id="job_razorpay" />
        <ApplyAskHost />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
  await screen.findByText('Senior UX Designer', {}, { timeout: 10000 });
}

const pressApply = async () => {
  await fireEvent.press(screen.getByLabelText('Apply now'));
  expect(await screen.findByText(APPLY_ASK_TITLE, {}, { timeout: 10000 })).toBeOnTheScreen();
};

/**
 * "Apply now" (owner, 2026-10-31). NextKin submits nothing: the button opens the employer's page
 * and the Applied list holds only what the candidate then tells us.
 */
jest.setTimeout(40000);

describe('Apply flow', () => {
  beforeEach(() => {
    resetMockRepos();
    mockStore.state.applications = [];
    mockOpenBrowser.mockClear();
    useApplyAskStore.setState({ ask: null });
    useAppToast.setState({ message: null });
  });

  afterEach(async () => {
    await Promise.all(clients.map((client) => client.cancelQueries()));
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
  });

  const applied = () => mockStore.state.applications.some((app) => app.jobId === 'job_razorpay');

  it('opens the employer’s page and records nothing until the candidate says so', async () => {
    await open();
    await pressApply();
    expect(mockOpenBrowser).toHaveBeenCalledTimes(1);
    expect(applied()).toBe(false);
    expect(screen.getByText('Senior UX Designer at Razorpay')).toBeOnTheScreen();
  });

  it('adds the job to the Applied list on "yes"', async () => {
    await open();
    await pressApply();
    await fireEvent.press(screen.getByLabelText(APPLY_ASK_YES));
    await waitFor(() => expect(applied()).toBe(true), { timeout: 10000 });
    expect(useApplyAskStore.getState().ask).toBeNull();
  });

  it('asks once more after "not yet", and never claims an application', async () => {
    await open();
    await pressApply();
    await fireEvent.press(screen.getByLabelText(APPLY_ASK_NOT_YET));
    await waitFor(() => expect(mockStore.state.applicationAsks[0]?.asksLeft).toBe(1), { timeout: 10000 });
    expect(applied()).toBe(false);
  });

  it('stops asking on "I won’t apply"', async () => {
    await open();
    await pressApply();
    await fireEvent.press(screen.getByLabelText(APPLY_ASK_NO));
    await waitFor(() => expect(mockStore.state.applicationAsks).toHaveLength(0), { timeout: 10000 });
    expect(applied()).toBe(false);
  });
});
