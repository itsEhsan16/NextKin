import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { subscriptionFixture, useMockModeStore } from '@/data/mock';
import type { Subscription } from '@/data/models';
import { createQueryClient, qk } from '@/data/queries';
import { repos, resetMockRepos } from '@/data/repos';
import { TailorCompareScreen } from '@/features/create';
import { useCustomizeStore } from '@/features/create/customizeStore';

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockSetParams = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    navigate: jest.fn(),
    back: mockBack,
    replace: mockReplace,
    setParams: mockSetParams,
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

const ALL_FIXES = ['headline', 'summary', 'skills', 'experience', 'projects', 'length'];

async function renderCustomize(
  props: { jobId?: string; jdId?: string; resumeId?: string },
  seed?: (client: QueryClient) => void,
) {
  const queryClient = createQueryClient();
  clients.push(queryClient);
  seed?.(queryClient);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>
        <TailorCompareScreen {...props} />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

const settle = (ms = 3000) => act(() => jest.advanceTimersByTimeAsync(ms));
const press = (label: string | RegExp) =>
  act(async () => fireEvent.press(screen.getByLabelText(label)));

describe('TailorCompareScreen — the one Customize screen (toreview §114)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
    useCustomizeStore.setState({ byKey: {} });
    [mockPush, mockBack, mockReplace, mockSetParams].forEach((mock) => mock.mockClear());
  });

  afterEach(async () => {
    await act(() => jest.runOnlyPendingTimersAsync());
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('scores out of 10 with its band and shows matched and tap-to-add keywords', async () => {
    await renderCustomize({ jobId: 'job_stripe', resumeId: 'res_base' });
    expect(screen.getByLabelText('Comparing your resume with this job')).toBeOnTheScreen();
    await settle();

    expect(screen.getByLabelText('Step 2 of 3')).toBeOnTheScreen();
    expect(screen.getByLabelText('Match 9.0 out of 10')).toBeOnTheScreen();
    expect(screen.getByText('Senior Product Designer · Stripe')).toBeOnTheScreen();
    // The AI's plan is already picked (§173).
    expect(screen.getByText('Summary aimed at Stripe')).toBeOnTheScreen();
    expect(screen.getByLabelText('Summary aimed at Stripe, on')).toBeOnTheScreen();
    // On the resume: ticked and locked. Missing: unticked until the user adds it (D-14).
    expect(screen.getByRole('checkbox', { name: 'Figma' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Fintech' })).not.toBeChecked();
    expect(screen.getByText('Tap the missing ones you really have.')).toBeOnTheScreen();
  });

  it('starts the run tailorRunInput builds from a tapped chip and the default options', async () => {
    const startSpy = jest.spyOn(repos.generations, 'start');
    await renderCustomize({ jobId: 'job_stripe', resumeId: 'res_base' });
    await settle();

    await act(async () => fireEvent.press(screen.getByRole('checkbox', { name: 'Fintech' })));
    expect(screen.getByRole('checkbox', { name: 'Fintech' })).toBeChecked();
    expect(screen.getByText('1 of 3 generations left this month')).toBeOnTheScreen();

    await press('Create my resume');
    await settle();

    expect(startSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'resume',
        jobId: 'job_stripe',
        baseResumeId: 'res_base',
        tailor: {
          sourceResumeId: 'res_base',
          baselineScore: 90,
          sourcePages: 3,
          added: ['Fintech'],
          skipped: [],
          fixes: ALL_FIXES,
          experience: 'full',
          confirmed: [{ keyword: 'Fintech', where: 'exp_4', by: 'ai' }],
        },
      }),
    );
    expect(mockReplace).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/generations/[id]' }),
    );
  });

  it('turns a plan step off with a tap, and it leaves the run', async () => {
    const startSpy = jest.spyOn(repos.generations, 'start');
    await renderCustomize({ jobId: 'job_stripe', resumeId: 'res_base' });
    await settle();

    await press('Skills ordered for this job, on');
    expect(screen.getByLabelText('Skills ordered for this job, off')).toBeOnTheScreen();
    await press('Create my resume');
    await settle();
    expect(startSpy.mock.calls[0]?.[0]?.tailor?.fixes).not.toContain('skills');
  });

  it('accepts the AI’s guess for a missing number with one tap', async () => {
    const startSpy = jest.spyOn(repos.generations, 'start');
    await renderCustomize({ jobId: 'job_stripe', resumeId: 'res_base' });
    await settle();
    await settle();

    expect(screen.getAllByText('about 20%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('AI guess — use it only if it’s close to true.').length).toBeGreaterThan(0);
    await act(async () => fireEvent.press(screen.getAllByRole('button', { name: 'Use' })[0]!));
    await press('Create my resume');
    await settle();
    const figures = startSpy.mock.calls[0]?.[0]?.tailor?.figures;
    expect(figures?.[0]?.text).toMatch(/about 20%/);
  });

  it('keeps the rare options in a sheet, and one switched off leaves the run', async () => {
    const startSpy = jest.spyOn(repos.generations, 'start');
    await renderCustomize({ jobId: 'job_stripe', resumeId: 'res_base' });
    await settle();

    expect(screen.queryByLabelText('Projects')).toBeNull();
    await press('More options');
    await settle(500);
    await act(async () => fireEvent.press(screen.getByLabelText('Projects')));
    await press('Done');
    await settle(500);
    await press('Create my resume');
    await settle();

    const input = startSpy.mock.calls[0]?.[0];
    expect(input?.tailor?.fixes).toEqual(['headline', 'summary', 'skills', 'experience', 'length']);
    expect(input?.tailor?.added).toEqual([]);
  });

  it('a tap is all it takes: nothing asks where, and the plan’s pick goes along (§129.6)', async () => {
    const startSpy = jest.spyOn(repos.generations, 'start');
    await renderCustomize({ jobId: 'job_stripe', resumeId: 'res_base' });
    await settle();
    await act(async () => fireEvent.press(screen.getByRole('checkbox', { name: 'Fintech' })));
    expect(screen.queryByText(/Used in/)).toBeNull();
    await press('Create my resume');
    await settle();
    const tailor = startSpy.mock.calls[0]?.[0]?.tailor;
    expect(tailor?.added).toEqual(['Fintech']);
    expect(tailor?.confirmed).toEqual([{ keyword: 'Fintech', where: 'exp_4', by: 'ai' }]);
  });

  it('works for a pasted job description: the JD’s title, no listing on the run', async () => {
    const reading = repos.jd.extract({
      source: 'paste',
      text: 'Senior Product Designer at Acme. Required: Figma, design systems. Fintech a plus.',
    });
    await settle();
    const draft = await reading;
    const startSpy = jest.spyOn(repos.generations, 'start');
    await renderCustomize({ jdId: draft.id, resumeId: 'res_base' });
    await settle();

    expect(screen.getByText(/^Senior Product Designer/)).toBeOnTheScreen();
    await press('View the job');
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/create/jd',
      params: { draftId: draft.id },
    });

    await press('Create my resume');
    await settle();
    const input = startSpy.mock.calls[0]?.[0];
    expect(input?.jdId).toBe(draft.id);
    expect(input).not.toHaveProperty('jobId');
  });

  it('picks the base resume when none was named', async () => {
    await renderCustomize({ jobId: 'job_stripe' });
    // Resumes first, then the picked one and its comparison.
    await settle();
    await settle();
    await settle();
    expect(screen.getByText('Product Designer')).toBeOnTheScreen();
    expect(screen.queryByText('Which resume should we tailor?')).toBeNull();
  });

  it('offers upload or a build from the profile when there is no resume', async () => {
    jest.spyOn(repos.resumes, 'list').mockResolvedValue([]);
    await renderCustomize({ jobId: 'job_stripe' });
    await settle();

    expect(screen.getByText('First, a resume to work from')).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Upload your resume/)).toBeOnTheScreen();
    await press(/^Build from my profile/);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/create/build/compare',
      params: { jobId: 'job_stripe' },
    });
  });

  it('routes a spent allowance to the Pro plans instead of starting a run', async () => {
    await renderCustomize({ jobId: 'job_stripe', resumeId: 'res_base' }, (client) =>
      client.setQueryData(qk.user.subscription(), spentSubscription),
    );
    await settle();

    expect(screen.queryByLabelText('Create my resume')).toBeNull();
    await press('See Pro plans');
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/upgrade',
      params: { reason: 'generations' },
    });
  });

  it('keeps the choices for the same job and resume across a remount', async () => {
    await renderCustomize({ jobId: 'job_stripe', resumeId: 'res_base' });
    await settle();
    await act(async () => fireEvent.press(screen.getByRole('checkbox', { name: 'Fintech' })));
    await cleanup();

    await renderCustomize({ jobId: 'job_stripe', resumeId: 'res_base' });
    await settle();
    expect(screen.getByRole('checkbox', { name: 'Fintech' })).toBeChecked();
  });

  it('says so when the job no longer exists', async () => {
    await renderCustomize({ jobId: 'job_missing', resumeId: 'res_base' });
    await settle(10000);
    expect(screen.getByText('This job isn’t available')).toBeOnTheScreen();
  });

  it('offers a retry when loading fails', async () => {
    useMockModeStore.setState({ mode: 'error' });
    await renderCustomize({ jobId: 'job_stripe', resumeId: 'res_base' });
    await settle(10000);
    expect(screen.getByLabelText('Try again')).toBeOnTheScreen();
  });
});
