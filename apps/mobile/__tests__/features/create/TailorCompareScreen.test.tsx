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
/** The footer's one button: "Continue", or "Add N Keyword(s) & Continue" once any are ticked. */
const CTA = /^(Continue|Add \d+ keywords?)$/;
/** The All tab lists every keyword, the resume's own ones ticked and locked. */
const showAll = () => act(async () => fireEvent.press(screen.getByText(/^All \(/)));

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

  it('scores out of 10 with its band and lists the keywords to tick (§234)', async () => {
    await renderCustomize({ jobId: 'job_stripe', resumeId: 'res_base' });
    expect(screen.getByLabelText('Comparing your resume with this job')).toBeOnTheScreen();
    await settle();

    expect(screen.getByLabelText('Step 2 of 3, Choose Keywords')).toBeOnTheScreen();
    expect(screen.getByText('Choose keywords to add')).toBeOnTheScreen();
    expect(screen.getByLabelText('ATS score 8.3 out of 10')).toBeOnTheScreen();
    expect(screen.getByText('Senior Product Designer · Stripe')).toBeOnTheScreen();
    expect(screen.getByText(/^Missing \(/)).toBeOnTheScreen();
    // The AI's changes are already picked (§173).
    expect(screen.getByText('Summary aimed at Stripe')).toBeOnTheScreen();
    expect(screen.getByLabelText('Summary aimed at Stripe, on')).toBeOnTheScreen();
    // On the resume: ticked and locked (All). Missing: unticked until the user adds it (D-25).
    await showAll();
    expect(screen.getByRole('checkbox', { name: 'Figma' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Fintech' })).not.toBeChecked();
    expect(screen.getByText('Tick the keywords you have to see what they add.')).toBeOnTheScreen();
  });

  it('the card and the footer count what a tick adds', async () => {
    await renderCustomize({ jobId: 'job_stripe', resumeId: 'res_base' });
    await settle();
    await showAll();
    await act(async () => fireEvent.press(screen.getByRole('checkbox', { name: 'Fintech' })));
    expect(screen.getByLabelText('Add 1 keyword')).toBeOnTheScreen();
    // Select all is a tick on the right of the list, with no words beside it (§236).
    await act(async () => fireEvent.press(screen.getByRole('checkbox', { name: 'Fintech' })));
    await act(async () => fireEvent.press(screen.getByRole('checkbox', { name: 'Select all' })));
    expect(screen.getByRole('checkbox', { name: 'Fintech' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Select all' })).toBeChecked();
    expect(screen.queryByText(/to choose from/)).toBeNull();
    expect(screen.queryByText(/keywords? selected/)).toBeNull();
    expect(screen.getByText('If you add 1 selected keyword')).toBeOnTheScreen();
    expect(screen.getByText(/points \(est\.\)$/)).toBeOnTheScreen();
  });

  it('starts the run tailorRunInput builds from a tapped chip and the default options', async () => {
    const startSpy = jest.spyOn(repos.generations, 'start');
    await renderCustomize({ jobId: 'job_stripe', resumeId: 'res_base' });
    await settle();

    await showAll();
    await act(async () => fireEvent.press(screen.getByRole('checkbox', { name: 'Fintech' })));
    expect(screen.getByRole('checkbox', { name: 'Fintech' })).toBeChecked();

    await press(CTA);
    await settle();

    expect(startSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'resume',
        jobId: 'job_stripe',
        baseResumeId: 'res_base',
        tailor: {
          sourceResumeId: 'res_base',
          baselineScore: 83,
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
    await press(CTA);
    await settle();
    expect(startSpy.mock.calls[0]?.[0]?.tailor?.fixes).not.toContain('skills');
  });

  it('ticks a result on: a sheet offers the AI’s guess, and a tap adds it (§174)', async () => {
    const startSpy = jest.spyOn(repos.generations, 'start');
    // The seeded resume already states five results, which the coverage rubric counts as full
    // marks (D-25, toreview §211), so its plan asks for none. This one line is given a step.
    const compare = repos.jd.compare.bind(repos.jd);
    jest.spyOn(repos.jd, 'compare').mockImplementation(async (...args) => {
      const comparison = await compare(...args);
      if (!comparison.plan) return comparison;
      const step = {
        id: 'path:figure:exp_4:0',
        kind: 'number' as const,
        title: 'Add the result to “Ran the design reviews”',
        have: 'No measured result yet',
        worth: 0.2,
        basis: 'Take the suggested result or write your own.',
        who: 'you' as const,
        bullet: { roleId: 'exp_4', index: 0, text: 'Ran the design reviews' },
      };
      return {
        ...comparison,
        plan: { ...comparison.plan, steps: [...comparison.plan.steps, step] },
      };
    });
    await renderCustomize({ jobId: 'job_stripe', resumeId: 'res_base' });
    await settle();
    await settle();

    expect(screen.getAllByText(/AI suggests about 20%/).length).toBeGreaterThan(0);
    await act(async () =>
      fireEvent.press(screen.getAllByLabelText('Add a result to a bullet, off')[0]!),
    );
    await settle();
    // The sheet opens on the AI's first result at its smallest amount: nothing to type (§212).
    expect(
      screen.getByText('The AI’s suggestion. Keep it only if it’s true, or change it.'),
    ).toBeOnTheScreen();
    await press('Add to bullet');
    await settle();
    expect(screen.getAllByLabelText('Add a result to a bullet, on').length).toBe(1);
    await press(CTA);
    await settle();
    const figures = startSpy.mock.calls[0]?.[0]?.tailor?.figures;
    expect(figures?.[0]?.text).toMatch(/saving 2 hours of manual work a week/);
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
    await press(CTA);
    await settle();

    const input = startSpy.mock.calls[0]?.[0];
    expect(input?.tailor?.fixes).toEqual(['headline', 'summary', 'skills', 'experience', 'length']);
    expect(input?.tailor?.added).toEqual([]);
  });

  it('a tap is all it takes: nothing asks where, and the plan’s pick goes along (§129.6)', async () => {
    const startSpy = jest.spyOn(repos.generations, 'start');
    await renderCustomize({ jobId: 'job_stripe', resumeId: 'res_base' });
    await settle();
    await showAll();
    await act(async () => fireEvent.press(screen.getByRole('checkbox', { name: 'Fintech' })));
    expect(screen.queryByText(/Used in/)).toBeNull();
    await press(CTA);
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

    await press(CTA);
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
    expect(screen.getByText('Using Product Designer')).toBeOnTheScreen();
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

    expect(screen.queryByLabelText(CTA)).toBeNull();
    await press('See Pro plans');
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/upgrade',
      params: { reason: 'generations' },
    });
  });

  it('keeps the choices for the same job and resume across a remount', async () => {
    await renderCustomize({ jobId: 'job_stripe', resumeId: 'res_base' });
    await settle();
    await showAll();
    await act(async () => fireEvent.press(screen.getByRole('checkbox', { name: 'Fintech' })));
    await cleanup();

    await renderCustomize({ jobId: 'job_stripe', resumeId: 'res_base' });
    await settle();
    await showAll();
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
