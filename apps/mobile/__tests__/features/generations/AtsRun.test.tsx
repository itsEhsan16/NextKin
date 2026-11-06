import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import { ATS_CHECK_LEDE, scoreLead } from '@/data/models';
import { createQueryClient } from '@/data/queries';
import { GENERATION_TICK_MS, mockStore, repos, resetMockRepos } from '@/data/repos';
import { GenerationScreen } from '@/features/generations';
import { atsProgressRows } from '@/features/generations/components/atsRun';

const mockPush = jest.fn();
const mockBack = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    navigate: jest.fn(),
    back: mockBack,
    replace: jest.fn(),
    dismissTo: jest.fn(),
  }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const settle = (ms: number) => act(() => jest.advanceTimersByTimeAsync(ms));
const SLOW_MS = 2500;

/** An outside CV, read, then checked against Stripe — the way ATS 01 starts one. */
async function startCheck(): Promise<{ id: string; resumeId: string }> {
  const importing = repos.resumes.importFromFile({ name: 'George_Smith_CV.pdf', uri: 'file://cv' });
  await settle(SLOW_MS);
  const { resume } = await importing;
  const extracting = repos.jd.extract({ source: 'job', jobId: 'job_stripe' });
  await settle(SLOW_MS);
  const draft = await extracting;
  const starting = repos.generations.start({
    kind: 'ats_check',
    sourceResumeId: resume.id,
    jdId: draft.id,
    jobId: 'job_stripe',
  });
  await settle(SLOW_MS);
  return { id: (await starting).id, resumeId: resume.id };
}

async function renderGeneration(id: string) {
  const queryClient = createQueryClient();
  clients.push(queryClient);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>
        <GenerationScreen id={id} />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
  await settle(1000);
}

const press = (label: string) =>
  act(async () => void fireEvent.press(screen.getByLabelText(label)));

describe('GenerationScreen — ATS check run (ATS 02–03)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
    mockPush.mockClear();
    mockBack.mockClear();
  });

  afterEach(async () => {
    await act(() => jest.runOnlyPendingTimersAsync());
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
    jest.useRealTimers();
  });

  it('checks against Stripe’s job, and Cancel stops the run and hands the check back', async () => {
    const before = mockStore.state.subscription.usage.atsChecksUsed ?? 0;
    const { id } = await startCheck();
    await renderGeneration(id);
    // ATS 01's extraction is in the cache in the app; started from the repo here, it loads.
    await settle(1000);

    expect(screen.getByRole('header', { name: 'Checking your resume' })).toBeOnTheScreen();
    expect(screen.getByText('This usually takes less than 30 seconds.')).toBeOnTheScreen();
    expect(
      screen.getByLabelText(/^Checking against Stripe’s job, \d+% complete$/),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Preparing your results, /)).toBeOnTheScreen();

    await press('Cancel');
    await settle(1000);
    expect(mockStore.state.generations.find((g) => g.id === id)?.status).toBe('failed');
    expect(mockStore.state.subscription.usage.atsChecksUsed).toBe(before);
    expect(mockBack).toHaveBeenCalled();
  });

  it('shows the verdict, the gaps and the fixes, then fixes it for the job', async () => {
    const { id, resumeId } = await startCheck();
    await renderGeneration(id);
    await settle(GENERATION_TICK_MS * 9);
    await settle(1000);

    // The verdict is the engine run's (C-10); ATS 03's seeded 64 is gone with the other boards'
    // totals, so the screen is held to whatever the stored check says.
    const check = mockStore.state.generations.find((g) => g.id === id)?.atsCheck;
    if (!check) throw new Error('the check should have a result');
    // The count leads, with the verdict beside it, then the parts and what isn't measured.
    const lead = scoreLead(check.report);
    if (!lead) throw new Error('a check against a job counts its required skills');
    expect(screen.getByRole('header', { name: `${lead.headline} skills` })).toBeOnTheScreen();
    expect(screen.getByLabelText(`Missing: ${check.missing.length}`)).toBeOnTheScreen();
    expect(screen.getByLabelText(`Fixes: ${check.fixes.length}`)).toBeOnTheScreen();
    // The score's parts and what it doesn't measure sit folded until asked (§173).
    expect(screen.queryByRole('header', { name: 'Where your points go' })).toBeNull();
    await press(`Score details, ${ATS_CHECK_LEDE[check.band]}`);
    expect(screen.getByRole('header', { name: 'Where your points go' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'What this doesn’t measure' })).toBeOnTheScreen();
    // The uploaded CV shows Fintech in a dated role, and a check reads the document on its own
    // terms, so Stripe's listing has nothing left missing.
    expect(check.missing).toEqual([]);
    expect(screen.queryByText(/^d+ missing$/)).toBeNull();
    const [first] = check.fixes;
    expect(first).toBeDefined();
    await press(
      `${check.fixes.length} ${check.fixes.length === 1 ? 'fix' : 'fixes'}, ${check.fixes
        .map((f) => f.title)
        .slice(0, 3)
        .join(', ')}`,
    );
    expect(screen.getByLabelText(`1. ${first?.title}. ${first?.detail}`)).toBeOnTheScreen();
    expect(screen.getByText('Saves a tailored copy first')).toBeOnTheScreen();

    await press('How the ATS score works');
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/resumes/[id]/rubric',
      params: { id: resumeId },
    });

    await press('Fix it for this job');
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/create/tailor',
      params: { jobId: 'job_stripe', resumeId },
    });
  });
});

describe('atsProgressRows', () => {
  const base = { ...mockStore.state.generations[0]!, kind: 'ats_check' as const };

  it('is matching your skills at the board’s 55%', () => {
    const rows = atsProgressRows({ ...base, status: 'validating', progress: 0.55 });
    expect(rows.map((row) => row.state)).toEqual(['done', 'done', 'current', 'todo', 'todo']);
  });
});
