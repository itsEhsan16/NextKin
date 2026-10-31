import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren, ReactElement } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { subscriptionFixture, useMockModeStore } from '@/data/mock';
import type { Subscription } from '@/data/models';
import { createQueryClient, qk } from '@/data/queries';
import { mockStore, repos, resetMockRepos } from '@/data/repos';
import { BuildChooseJobScreen, BuildJobScreen } from '@/features/create';
import { useBuildSourceStore } from '@/features/create/buildSourceStore';
import { pickDocument } from '@/lib';

jest.mock('@/lib', () => ({
  ...jest.requireActual('@/lib'),
  pickDocument: jest.fn(),
}));

const pick = pickDocument as jest.MockedFunction<typeof pickDocument>;

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
    useBuildSourceStore.getState().reset();
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

  it('BUILD 01 lists the saved job, starts from the best resume, and a tap opens the comparison', async () => {
    const extractSpy = jest.spyOn(repos.jd, 'extract');
    const startSpy = jest.spyOn(repos.generations, 'start');
    await renderScreen(<BuildJobScreen />);
    await settle();

    expect(screen.getByText('Which job is this resume for?')).toBeOnTheScreen();
    expect(screen.getByText('Pick a job and we’ll build your resume for it.')).toBeOnTheScreen();
    // One saved job (the owner's cut, toreview §139); the rest are behind See all.
    expect(screen.getByText('Senior Product Designer')).toBeOnTheScreen();
    expect(screen.queryByText('Product Designer')).not.toBeOnTheScreen();
    expect(screen.queryByText('Senior UX Designer')).not.toBeOnTheScreen();
    expect(screen.queryByText('Design Systems Lead')).not.toBeOnTheScreen();
    expect(screen.getByText('See all (12)')).toBeOnTheScreen();
    expect(screen.getByText('Stripe · Bengaluru · Remote')).toBeOnTheScreen();
    expect(screen.getByText('Built from Product Designer')).toBeOnTheScreen();
    // Nothing is spent here, so nothing says what it costs.
    expect(screen.queryByText(/resume builds this month/)).not.toBeOnTheScreen();

    await act(async () =>
      fireEvent.press(screen.getByLabelText(/^Senior Product Designer, Stripe/)),
    );
    await settle();

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/create/tailor',
      params: { jobId: 'job_stripe', resumeId: 'res_base' },
    });
    expect(extractSpy).not.toHaveBeenCalled();
    expect(startSpy).not.toHaveBeenCalled();
  });

  it('BUILD 01 builds from the profile for someone with no resume', async () => {
    mockStore.state.resumes = [];
    await renderScreen(<BuildJobScreen />);
    await settle();

    expect(
      screen.getByText(/^Built from your profile · \d+ roles?, \d+ skills?$/),
    ).toBeOnTheScreen();
    await act(async () =>
      fireEvent.press(screen.getByLabelText(/^Senior Product Designer, Stripe/)),
    );
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/create/build/compare',
      params: { jobId: 'job_stripe' },
    });
  });

  it('BUILD 01 sends someone with no resume and no roles to the upload-or-start card', async () => {
    mockStore.state.resumes = [];
    mockStore.state.profile = { ...mockStore.state.profile, experiences: [] };
    await renderScreen(<BuildJobScreen />);
    await settle();

    await act(async () =>
      fireEvent.press(screen.getByLabelText(/^Senior Product Designer, Stripe/)),
    );
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/create/tailor',
      params: { jobId: 'job_stripe' },
    });
  });

  it('BUILD 01 can be switched to the profile, and starts over on the next visit', async () => {
    await renderScreen(<BuildJobScreen />);
    await settle();

    await act(async () =>
      fireEvent.press(screen.getByLabelText('Change what the resume is built from')),
    );
    await settle();
    await act(async () => fireEvent.press(screen.getByText('Your profile')));
    await settle();
    expect(screen.getByText(/^Built from your profile/)).toBeOnTheScreen();

    await act(async () =>
      fireEvent.press(screen.getByLabelText(/^Senior Product Designer, Stripe/)),
    );
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/create/build/compare',
      params: { jobId: 'job_stripe' },
    });

    await cleanup();
    expect(useBuildSourceStore.getState().picked).toBeUndefined();
  });

  it('BUILD 01 starts from a resume\u2019s own "Tailor to a job"', async () => {
    await renderScreen(<BuildJobScreen resumeId="res_1" />);
    await settle();

    expect(screen.getByText('Built from UX Designer Resume')).toBeOnTheScreen();
  });

  it('BUILD 01 routes See all and the anywhere tile', async () => {
    await renderScreen(<BuildJobScreen />);
    await settle();

    await act(async () => fireEvent.press(screen.getByLabelText('See all (12)')));
    expect(mockPush).toHaveBeenCalledWith('/create/build/jobs');
    await act(async () => fireEvent.press(screen.getByLabelText('Add a job from anywhere')));
    expect(mockPush).toHaveBeenCalledWith('/create/build/add');
  });

  it('BUILD 01 builds from a resume instead, through Customize (toreview §139)', async () => {
    await renderScreen(<BuildJobScreen />);
    await settle();

    await act(async () =>
      fireEvent.press(screen.getByLabelText('Change what the resume is built from')),
    );
    await settle();
    expect(screen.getByText('Build from')).toBeOnTheScreen();
    expect(screen.getByText('Your profile')).toBeOnTheScreen();
    // The two latest resumes, then an upload; older ones and cover letters are not offered.
    expect(screen.getByText('UX Designer Resume')).toBeOnTheScreen();
    expect(screen.getByText('Product Designer')).toBeOnTheScreen();
    expect(screen.queryByText('Stripe — Senior PD')).not.toBeOnTheScreen();
    expect(screen.queryByText('Stripe cover letter')).not.toBeOnTheScreen();
    expect(screen.getByText('Upload from your device')).toBeOnTheScreen();

    await act(async () => fireEvent.press(screen.getByText('UX Designer Resume')));
    await settle();
    expect(screen.getByText('Built from UX Designer Resume')).toBeOnTheScreen();

    await act(async () =>
      fireEvent.press(screen.getByLabelText(/^Senior Product Designer, Stripe/)),
    );
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/create/tailor',
      params: { jobId: 'job_stripe', resumeId: 'res_1' },
    });
    expect(mockPush).not.toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/create/build/compare' }),
    );
  });

  it('BUILD 01 builds from a resume uploaded from the device', async () => {
    pick.mockResolvedValue({ name: 'George_Smith_Resume.pdf', uri: 'file:///tmp/george.pdf' });
    await renderScreen(<BuildJobScreen />);
    await settle();

    await act(async () =>
      fireEvent.press(screen.getByLabelText('Change what the resume is built from')),
    );
    await settle();
    await act(async () => fireEvent.press(screen.getByText('Upload from your device')));
    expect(screen.getByText('Reading George_Smith_Resume.pdf…')).toBeOnTheScreen();
    await settle();

    expect(screen.getByText(/^Built from /)).toBeOnTheScreen();
    expect(screen.queryByText(/^Built from your profile/)).not.toBeOnTheScreen();
    await act(async () =>
      fireEvent.press(screen.getByLabelText(/^Senior Product Designer, Stripe/)),
    );
    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/create/tailor',
        params: expect.objectContaining({ jobId: 'job_stripe', resumeId: expect.any(String) }),
      }),
    );
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
    useBuildSourceStore.setState({ picked: null });
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
