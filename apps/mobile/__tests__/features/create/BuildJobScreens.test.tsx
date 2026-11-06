import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren, ReactElement } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { mockStore, repos, resetMockRepos } from '@/data/repos';
import { BuildJobScreen } from '@/features/create';
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

describe('Build Resume step 1: the job (§172)', () => {
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

    expect(screen.getByRole('header', { name: 'Which job is it for?' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Step 1 of 3')).toBeOnTheScreen();
    // Every saved job is listed on the one screen now, searchable.
    expect(screen.getByText('Senior Product Designer')).toBeOnTheScreen();
    expect(screen.getAllByText('Design Systems Lead').length).toBeGreaterThan(0);
    expect(screen.getByText('Saved (12)')).toBeOnTheScreen();
    expect(screen.getByLabelText('Built from Product Designer. Change')).toBeOnTheScreen();
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

    expect(screen.getByLabelText('Built from Your profile. Change')).toBeOnTheScreen();
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
      fireEvent.press(screen.getByLabelText(/^Built from .*Change$/)),
    );
    await settle();
    await act(async () => fireEvent.press(screen.getByText('Your profile')));
    await settle();
    expect(screen.getByLabelText('Built from Your profile. Change')).toBeOnTheScreen();

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

    expect(screen.getByLabelText('Built from UX Designer Resume. Change')).toBeOnTheScreen();
  });

  it('reads a pasted link and goes straight to the match', async () => {
    useBuildSourceStore.setState({ picked: null });
    await renderScreen(<BuildJobScreen />);
    await settle();

    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeOnTheScreen();
    await act(async () =>
      fireEvent.changeText(
        screen.getByLabelText('Job link or description'),
        'Senior designer at CRED. We want Figma, prototyping and design systems.',
      ),
    );
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Continue' })));
    await settle();
    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/create/build/compare',
        params: { jdId: expect.any(String) },
      }),
    );
  });

  it('BUILD 01 builds from a resume instead, through Customize (toreview §139)', async () => {
    await renderScreen(<BuildJobScreen />);
    await settle();

    await act(async () =>
      fireEvent.press(screen.getByLabelText(/^Built from .*Change$/)),
    );
    await settle();
    expect(screen.getByText('Build from')).toBeOnTheScreen();
    expect(screen.getByText('Your profile')).toBeOnTheScreen();
    // The two latest resumes, then an upload; older ones and cover letters are not offered.
    expect(screen.getByText('UX Designer Resume')).toBeOnTheScreen();
    // Twice since §174: the "From" pill on the page and the row in the sheet drawn over it.
    expect(screen.getAllByText('Product Designer').length).toBeGreaterThan(0);
    expect(screen.queryByText('Stripe — Senior PD')).not.toBeOnTheScreen();
    expect(screen.queryByText('Stripe cover letter')).not.toBeOnTheScreen();
    expect(screen.getByText('Upload from your device')).toBeOnTheScreen();

    await act(async () => fireEvent.press(screen.getByText('UX Designer Resume')));
    await settle();
    expect(screen.getByLabelText('Built from UX Designer Resume. Change')).toBeOnTheScreen();

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
      fireEvent.press(screen.getByLabelText(/^Built from .*Change$/)),
    );
    await settle();
    await act(async () => fireEvent.press(screen.getByText('Upload from your device')));
    expect(screen.getByLabelText('Built from Reading George_Smith_Resume.pdf…. Change')).toBeOnTheScreen();
    await settle();

    expect(screen.queryByLabelText('Built from Your profile. Change')).not.toBeOnTheScreen();
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

    await act(async () => fireEvent.press(screen.getByLabelText('Browse jobs')));
    expect(mockNavigate).toHaveBeenCalledWith('/(tabs)/jobs');
    expect(screen.getByLabelText('Job link or description')).toBeOnTheScreen();
  });
});
