import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren, ReactElement } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { subscriptionFixture, useMockModeStore } from '@/data/mock';
import type { Subscription } from '@/data/models';
import { createQueryClient, qk } from '@/data/queries';
import { repos, resetMockRepos } from '@/data/repos';
import { BuildChooseJobScreen, BuildJobScreen } from '@/features/create';

const mockPush = jest.fn();
const mockNavigate = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    navigate: mockNavigate,
    back: mockBack,
    replace: mockReplace,
    setParams: jest.fn(),
  }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const spentSubscription: Subscription = {
  ...subscriptionFixture,
  usage: { ...subscriptionFixture.usage, generationsUsed: 3, generationsLimit: 3 },
};

async function renderScreen(ui: ReactElement, seed?: (client: QueryClient) => void) {
  const queryClient = createQueryClient();
  clients.push(queryClient);
  seed?.(queryClient);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </SafeAreaProvider>,
  );
}

const settle = (ms = 3000) => act(() => jest.advanceTimersByTimeAsync(ms));
const spend = (client: QueryClient) =>
  client.setQueryData(qk.user.subscription(), spentSubscription);

describe('Build Resume: BUILD 01 / 02', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
    [mockPush, mockNavigate, mockBack, mockReplace].forEach((mock) => mock.mockClear());
  });

  afterEach(async () => {
    await act(() => jest.runOnlyPendingTimersAsync());
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('BUILD 01 lists the top three saved jobs, and a tap opens the comparison', async () => {
    const extractSpy = jest.spyOn(repos.jd, 'extract');
    const startSpy = jest.spyOn(repos.generations, 'start');
    await renderScreen(<BuildJobScreen />);
    await settle();

    expect(screen.getByText('Which job is this resume for?')).toBeOnTheScreen();
    expect(screen.getByText('Pick a job and we’ll build your resume for it.')).toBeOnTheScreen();
    expect(screen.getByText('Senior Product Designer')).toBeOnTheScreen();
    expect(screen.getByText('Product Designer')).toBeOnTheScreen();
    expect(screen.getByText('Senior UX Designer')).toBeOnTheScreen();
    expect(screen.queryByText('Design Systems Lead')).not.toBeOnTheScreen();
    expect(screen.getByText('See all (12)')).toBeOnTheScreen();
    expect(screen.getByText('Stripe · Bengaluru · Remote')).toBeOnTheScreen();
    expect(
      screen.getByText(/^Built from your profile · \d+ roles?, \d+ skills?$/),
    ).toBeOnTheScreen();
    // Nothing is spent here, so nothing says what it costs.
    expect(screen.queryByText(/resume builds this month/)).not.toBeOnTheScreen();

    await act(async () =>
      fireEvent.press(screen.getByLabelText(/^Senior Product Designer, Stripe/)),
    );
    await settle();

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/create/build/compare',
      params: { jobId: 'job_stripe' },
    });
    expect(extractSpy).not.toHaveBeenCalled();
    expect(startSpy).not.toHaveBeenCalled();
  });

  it('BUILD 01 routes See all, the anywhere tile and Edit', async () => {
    await renderScreen(<BuildJobScreen />);
    await settle();

    await act(async () => fireEvent.press(screen.getByLabelText('See all (12)')));
    expect(mockPush).toHaveBeenCalledWith('/create/build/jobs');
    await act(async () => fireEvent.press(screen.getByLabelText('Add a job from anywhere')));
    expect(mockPush).toHaveBeenCalledWith('/create/build/add');
    await act(async () => fireEvent.press(screen.getByLabelText('Edit your profile')));
    expect(mockPush).toHaveBeenCalledWith('/profile/edit');
  });

  it('BUILD 01 offers Browse jobs when nothing is saved', async () => {
    jest.spyOn(repos.jobs, 'listSaved').mockResolvedValue([]);
    await renderScreen(<BuildJobScreen />);
    await settle();

    expect(screen.queryByText(/^See all/)).not.toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByLabelText('Browse jobs')));
    expect(mockNavigate).toHaveBeenCalledWith('/(tabs)/jobs');
    expect(screen.getByLabelText('Add a job from anywhere')).toBeOnTheScreen();
  });

  it('BUILD 02 preselects the first job, searches, switches tabs and compares the pick', async () => {
    const startSpy = jest.spyOn(repos.generations, 'start');
    await renderScreen(<BuildChooseJobScreen />);
    await settle();

    expect(screen.getByText('Choose a job')).toBeOnTheScreen();
    expect(screen.getByText('Pick the job you want this resume built for.')).toBeOnTheScreen();
    expect(screen.getByText('Saved jobs (12)')).toBeOnTheScreen();
    expect(screen.getByText('Uses 1 of your 3 resume builds this month')).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Senior Product Designer, Stripe/)).toBeSelected();
    expect(screen.getByLabelText('Build resume for Stripe')).toBeOnTheScreen();

    await act(async () =>
      fireEvent.press(screen.getByLabelText(/^Design Systems Lead, Freshworks/)),
    );
    expect(screen.getByLabelText(/^Design Systems Lead, Freshworks/)).toBeSelected();
    expect(screen.getByLabelText('Build resume for Freshworks')).toBeOnTheScreen();

    await act(async () => fireEvent.changeText(screen.getByLabelText('Search your jobs'), 'razor'));
    expect(screen.queryByText('Design Systems Lead')).not.toBeOnTheScreen();
    expect(screen.getByLabelText(/^Senior UX Designer, Razorpay/)).toBeSelected();

    await act(async () => fireEvent.changeText(screen.getByLabelText('Search your jobs'), 'zzz'));
    expect(screen.getByText('No jobs match your search')).toBeOnTheScreen();
    await act(async () => fireEvent.changeText(screen.getByLabelText('Search your jobs'), ''));

    await act(async () => fireEvent.press(screen.getByText('Top matches')));
    await settle();
    expect(screen.getByText('Lead UX Designer')).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByText('Saved jobs (12)')));
    await settle();

    await act(async () => fireEvent.press(screen.getByLabelText('Build resume for Freshworks')));
    await settle();
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/create/build/compare',
      params: { jobId: 'job_freshworks' },
    });
    expect(startSpy).not.toHaveBeenCalled();
  });

  it('BUILD 02 swaps the CTA for the Pro plans when the builds are spent', async () => {
    await renderScreen(<BuildChooseJobScreen />, spend);
    await settle();

    await act(async () => fireEvent.press(screen.getByLabelText('See Pro plans')));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/upgrade',
      params: { reason: 'generations' },
    });
  });
});
