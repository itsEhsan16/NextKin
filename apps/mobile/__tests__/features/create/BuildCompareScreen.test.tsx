import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { subscriptionFixture, useMockModeStore } from '@/data/mock';
import type { Subscription } from '@/data/models';
import { createQueryClient, qk } from '@/data/queries';
import { repos, resetMockRepos } from '@/data/repos';
import { BuildCompareScreen } from '@/features/create';

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    navigate: jest.fn(),
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

const settle = (ms = 3000) => act(() => jest.advanceTimersByTimeAsync(ms));

/** A job read on BUILD 03/04, asking for these skills (the profile has all but Fintech). */
async function seedDraft(requiredSkills: string[]): Promise<string> {
  const extracted = repos.jd.extract({ source: 'link', url: 'https://cred.club/careers/senior' });
  await settle();
  const { id } = await extracted;
  const updated = repos.jd.update(id, {
    title: 'Senior Product Designer',
    company: 'CRED',
    location: 'Bengaluru',
    requiredSkills,
    preferredSkills: [],
  });
  await settle();
  await updated;
  return id;
}

const BOARD_SKILLS = ['Design systems', 'Figma', 'Prototyping', 'User research', 'Fintech'];

async function renderCompare(
  props: { jobId?: string; jdId?: string },
  seed?: (client: QueryClient) => void,
) {
  const queryClient = createQueryClient();
  clients.push(queryClient);
  seed?.(queryClient);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>
        <BuildCompareScreen {...props} />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

describe('BuildCompareScreen (BUILD 04b / 04c)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
    [mockPush, mockBack, mockReplace].forEach((mock) => mock.mockClear());
  });

  afterEach(async () => {
    await act(() => jest.runOnlyPendingTimersAsync());
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('measures the profile against the read job, as job match rather than an ATS score', async () => {
    const jdId = await seedDraft(BOARD_SKILLS);
    await renderCompare({ jdId });
    expect(screen.getByLabelText('Comparing your profile with this job')).toBeOnTheScreen();
    await settle();

    expect(screen.getByLabelText('Job match 80 for this job')).toBeOnTheScreen();
    expect(screen.getByText(/Your profile covers .*CRED asks for/)).toBeOnTheScreen();
    expect(
      screen.getByLabelText('This job: Senior Product Designer, CRED · Bengaluru'),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText(/^Built from: Your profile, \d+ roles · 12 skills$/),
    ).toBeOnTheScreen();
    expect(screen.getByText('4 of 5 on your profile')).toBeOnTheScreen();
    expect(screen.getByLabelText('Figma, on your profile')).toBeOnTheScreen();
    expect(screen.getByLabelText('Fintech, missing')).toBeOnTheScreen();
    expect(
      screen.getByText('Missing ones are only added if you say you have them.'),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('Says Senior UX Designer. This job is Senior Product Designer.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('We’ll lead with what CRED asks for.')).toBeOnTheScreen();
    expect(screen.getByText('We’ll ask before adding anything new.')).toBeOnTheScreen();

    await act(async () => fireEvent.press(screen.getByLabelText('Edit your profile')));
    expect(mockPush).toHaveBeenCalledWith('/profile/edit');
  });

  it('asks about the missing keyword, then builds with the answer (BUILD 04c)', async () => {
    const startSpy = jest.spyOn(repos.generations, 'start');
    const jdId = await seedDraft(BOARD_SKILLS);
    await renderCompare({ jdId });
    await settle();

    await act(async () => fireEvent.press(screen.getByLabelText('Fix and build my resume')));
    expect(startSpy).not.toHaveBeenCalled();
    expect(screen.getByText('Add this to your resume?')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'CRED asks for it, but it isn’t on your profile. Only add it if you really have it.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText('Required by CRED')).toBeOnTheScreen();
    expect(screen.getByText('Anything you add is saved to your profile too.')).toBeOnTheScreen();
    expect(screen.getByText('Uses 1 of your 3 resume builds this month')).toBeOnTheScreen();

    // A required skill starts as Skip: nothing is claimed without the user's yes (V2 §7.8).
    await act(async () => fireEvent.press(screen.getByLabelText('Add Fintech')));
    await act(async () => fireEvent.press(screen.getByLabelText('Build my resume')));
    await settle();

    expect(startSpy).toHaveBeenCalledWith({
      kind: 'resume',
      jdId,
      origin: 'build',
      build: { added: ['Fintech'], skipped: [] },
    });
    expect(mockReplace).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/generations/[id]' }),
    );
  });

  it('builds at once when the profile already has everything the job asks for', async () => {
    const startSpy = jest.spyOn(repos.generations, 'start');
    const jdId = await seedDraft(['Figma', 'Design systems']);
    await renderCompare({ jdId });
    await settle();

    expect(screen.getByText('Uses 1 of your 3 resume builds this month')).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByLabelText('Fix and build my resume')));
    await settle();
    expect(screen.queryByText(/to your resume\?$/)).not.toBeOnTheScreen();
    expect(startSpy).toHaveBeenCalledWith(
      expect.objectContaining({ jdId, origin: 'build', build: { added: [], skipped: [] } }),
    );
  });

  it('routes a spent allowance to the Pro plans when nothing is left to ask', async () => {
    const startSpy = jest.spyOn(repos.generations, 'start');
    const jdId = await seedDraft(['Figma']);
    await renderCompare({ jdId }, (client) =>
      client.setQueryData(qk.user.subscription(), spentSubscription),
    );
    await settle();

    await act(async () => fireEvent.press(screen.getByLabelText('See Pro plans')));
    expect(startSpy).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/upgrade',
      params: { reason: 'generations' },
    });
  });

  it('reads a saved job the way the build will, and names its workplace', async () => {
    const forJob = jest.spyOn(repos.jd, 'forJob');
    await renderCompare({ jobId: 'job_stripe' });
    await settle();

    expect(forJob).toHaveBeenCalledWith('job_stripe');
    expect(screen.getByLabelText(/^This job: .+, Stripe · Bengaluru · Remote$/)).toBeOnTheScreen();
  });

  it('offers a retry when the job cannot be read', async () => {
    jest.spyOn(repos.jd, 'forJob').mockRejectedValue(new Error('offline'));
    await renderCompare({ jobId: 'job_stripe' });
    await settle();

    expect(screen.getByText("Couldn't compare your profile")).toBeOnTheScreen();
    expect(screen.getByLabelText('Try again')).toBeOnTheScreen();
  });
});
