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
/** The All tab lists every skill, the profile's own ones ticked and locked. */
const showAll = () => act(async () => fireEvent.press(screen.getByText(/^All \(/)));

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

describe('Build Resume step 2: the match (§172)', () => {
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

  it('shows the match, the job’s skills to tick and one build button (2 of 3, §235)', async () => {
    const jdId = await seedDraft(BOARD_SKILLS);
    await renderCompare({ jdId });
    expect(screen.getByLabelText('Comparing your profile with this job')).toBeOnTheScreen();
    await settle();

    expect(screen.getByLabelText('Step 2 of 3, Choose Keywords')).toBeOnTheScreen();
    expect(screen.getByText('Choose what to add')).toBeOnTheScreen();
    expect(screen.getByText('Senior Product Designer · CRED')).toBeOnTheScreen();
    expect(screen.getByLabelText('ATS score 8.0 out of 10')).toBeOnTheScreen();
    expect(screen.getByText('Good match'.toUpperCase())).toBeOnTheScreen();
    expect(screen.getByText('Using your profile')).toBeOnTheScreen();
    // On the profile: ticked and locked (All). Missing: off until the user says they have it.
    await showAll();
    expect(screen.getByRole('checkbox', { name: 'Figma' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Figma' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Fintech' })).not.toBeChecked();
    // The footer is one button now (toreview §236): no count, no allowance line.
    expect(screen.queryByText(/resume builds this month/)).not.toBeOnTheScreen();
  });

  it('builds with the skills the user ticked, and nothing they did not', async () => {
    const startSpy = jest.spyOn(repos.generations, 'start');
    const jdId = await seedDraft(BOARD_SKILLS);
    await renderCompare({ jdId });
    await settle();

    await showAll();
    await act(async () => fireEvent.press(screen.getByRole('checkbox', { name: 'Fintech' })));
    expect(screen.getByText('Added skills go on your profile too.')).toBeOnTheScreen();
    await act(async () =>
      fireEvent.press(screen.getByRole('button', { name: 'Add 1 keyword' })),
    );
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

  it('leaves untouched missing skills out of the resume', async () => {
    const startSpy = jest.spyOn(repos.generations, 'start');
    const jdId = await seedDraft(BOARD_SKILLS);
    await renderCompare({ jdId });
    await settle();

    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Build resume' })));
    await settle();
    expect(startSpy).toHaveBeenCalledWith(
      expect.objectContaining({ build: { added: [], skipped: ['Fintech'] } }),
    );
  });

  it('lists what the AI will write from the profile', async () => {
    const jdId = await seedDraft(BOARD_SKILLS);
    await renderCompare({ jdId });
    await settle();

    expect(screen.getByText('What the AI will write')).toBeOnTheScreen();
    expect(
      screen.getByText('Says Senior UX Designer. This job is Senior Product Designer.'),
    ).toBeOnTheScreen();
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
    expect(screen.getByText(/ · Stripe$/)).toBeOnTheScreen();
  });

  it('offers a retry when the job cannot be read', async () => {
    jest.spyOn(repos.jd, 'forJob').mockRejectedValue(new Error('offline'));
    await renderCompare({ jobId: 'job_stripe' });
    await settle();

    expect(screen.getByText('Couldn’t compare')).toBeOnTheScreen();
    expect(screen.getByLabelText('Try again')).toBeOnTheScreen();
  });
});
