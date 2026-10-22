import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { resumesFixture, subscriptionFixture, useMockModeStore } from '@/data/mock';
import type { Generation, Resume, Subscription } from '@/data/models';
import { createQueryClient, qk } from '@/data/queries';
import { mockStore, resetMockRepos } from '@/data/repos';
import { CoverLetterSetupScreen } from '@/features/create';
import {
  coverLetterQuotaNote,
  coverLetterSources,
  coverResumeMeta,
  pickCoverLetterSource,
} from '@/features/create/coverLetterSetup';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockNavigate = jest.fn();
const mockSetParams = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    navigate: mockNavigate,
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

/** The Free plan's one cover letter, still unspent — the state the real flow needs (V2 §13.3). */
const freshSubscription: Subscription = {
  ...subscriptionFixture,
  usage: { ...subscriptionFixture.usage, coverLettersUsed: 0, coverLettersLimit: 1 },
};

async function renderSetup(resumeId?: string, seed?: (client: QueryClient) => void) {
  const queryClient = createQueryClient();
  clients.push(queryClient);
  seed?.(queryClient);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>
        <CoverLetterSetupScreen resumeId={resumeId} />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
  return queryClient;
}

const fresh = (client: QueryClient) =>
  client.setQueryData(qk.user.subscription(), freshSubscription);

/** Mock repos resolve on (fake) timers: lists ≤ 900ms, starting a run a little longer. */
const settle = (ms: number) => act(() => jest.advanceTimersByTimeAsync(ms));
/**
 * The job is read once the resume names it, and that fetch starts in an effect React only flushes
 * when the act() scope closes — so the page lands after two scopes, not one long one.
 */
const settleChained = async () => {
  await settle(NORMAL_MS);
  await settle(NORMAL_MS);
};
const NORMAL_MS = 1000;
const START_MS = 2000;

/** The sheet's rows live in a modal layer the default query hides. */
const hidden = { includeHiddenElements: true } as const;
const press = (label: string) =>
  act(async () => void fireEvent.press(screen.getByLabelText(label, hidden)));

describe('cover letter setup copy (COVER 01)', () => {
  it('words the quota and the resume row the way the board does', () => {
    expect(coverLetterQuotaNote(0, 1)).toBe('1 of 1 cover letter left this month');

    // Scores come from the store, where the engines computed them (C-10).
    const stripe = mockStore.state.resumes.find((resume) => resume.id === 'res_2');
    const base = resumesFixture.find((resume) => resume.id === 'res_base');
    expect(stripe && coverResumeMeta(stripe)).toBe(
      `Tailored for this job · ATS score ${stripe?.atsScore}`,
    );
    // An unscored resume says nothing about a score rather than showing a zero.
    expect(base && coverResumeMeta({ ...base, atsScore: undefined })).not.toMatch(/ATS score/);
  });
});

describe('coverLetterSources (V2 §7.10)', () => {
  it('keeps only ready resumes that carry a linked job', () => {
    const sources = coverLetterSources(resumesFixture);

    expect(sources.some((resume) => resume.docType === 'cover_letter')).toBe(false);
    expect(sources.some((resume) => resume.id === 'res_base')).toBe(false);
    expect(sources.some((resume) => resume.status !== 'ready')).toBe(false);
    expect(sources.map((resume) => resume.id)).toContain('res_1');
  });

  it('prefers the requested resume and falls back to the most recent candidate', () => {
    const sources = coverLetterSources(resumesFixture);

    expect(pickCoverLetterSource(sources, 'res_2')?.id).toBe('res_2');
    expect(pickCoverLetterSource(sources, 'res_base')?.id).toBe(sources[0]?.id);
    expect(pickCoverLetterSource([], 'res_2')).toBeUndefined();
  });
});

describe('CoverLetterSetupScreen (COVER 01, 644:2)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
    [mockPush, mockReplace, mockBack, mockNavigate, mockSetParams].forEach((fn) => fn.mockClear());
  });

  afterEach(async () => {
    // Flush in-flight mock requests BEFORE unmounting, so a late React Query update does not
    // open an act() scope that overlaps the next test's.
    await act(() => jest.runOnlyPendingTimersAsync());
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
    jest.useRealTimers();
  });

  it('shows the spent quota and the upgrade route the fixture account is on', async () => {
    await renderSetup('res_2');
    expect(screen.getByLabelText('Loading cover letter setup')).toBeOnTheScreen();
    // The bar is pinned while loading too — it owns the bottom safe-area inset.
    expect(screen.getByLabelText('Write my cover letter')).toBeDisabled();

    await settleChained();

    expect(screen.getByRole('header', { name: 'Cover letter for this job' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Step 1 of 3, Set up')).toBeOnTheScreen();
    expect(
      screen.getByText("You've used this month's 1 cover letter. Pro raises the monthly cap."),
    ).toBeOnTheScreen();

    // §13.5: the upsell REPLACES the action rather than interrupting the page with an alert.
    expect(screen.queryByLabelText('Write my cover letter')).toBeNull();
    await act(async () => fireEvent.press(screen.getByLabelText('See Pro plans')));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/upgrade',
      params: { reason: 'cover_letters' },
    });
  });

  it('writes the letter for the job the resume was tailored to, in the chosen tone', async () => {
    const client = await renderSetup('res_2', fresh);
    await settleChained();

    expect(
      screen.getByLabelText('Job: Senior Product Designer, Stripe · Bengaluru · Remote'),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText(
        `Resume: Stripe — Senior PD, Tailored for this job · ATS score ${mockStore.state.atsScores.res_2?.total}`,
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText('1 of 1 cover letter left this month')).toBeOnTheScreen();

    // Professional is the default; every tone card says what it sounds like.
    expect(screen.getByRole('radio', { name: 'Professional' })).toBeSelected();
    expect(screen.getByText('Measured and formal — the safe default')).toBeOnTheScreen();
    expect(screen.getByText('Leads with results and claims them')).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByRole('radio', { name: 'Confident' })));
    expect(screen.getByRole('radio', { name: 'Confident' })).toBeSelected();
    expect(screen.getByRole('radio', { name: 'Professional' })).not.toBeSelected();

    await act(async () => fireEvent.press(screen.getByLabelText('Write my cover letter')));
    await settle(START_MS);

    const started = client.getQueryData<Generation>(qk.generations.active());
    expect(started?.kind).toBe('cover_letter');
    expect(started?.tone).toBe('confident');
    expect(started?.jobId).toBe('job_stripe');
    expect(started?.sourceResumeId).toBe('res_2');

    // The intake is replaced by the run it started, and only once the run exists.
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/generations/[id]',
      params: { id: started?.id },
    });
  });

  it('writes from a resume tailored for no job, without a job row', async () => {
    const client = await renderSetup('res_base', fresh);
    await settle(NORMAL_MS);

    expect(screen.getByRole('header', { name: 'Cover letter' })).toBeOnTheScreen();
    expect(screen.queryByLabelText(/^Job: /)).toBeNull();
    expect(screen.getByLabelText(/^Resume: Product Designer, Base resume/)).toBeOnTheScreen();

    await act(async () => fireEvent.press(screen.getByLabelText('Write my cover letter')));
    await settle(START_MS);

    const started = client.getQueryData<Generation>(qk.generations.active());
    expect(started?.sourceResumeId).toBe('res_base');
    expect(started?.jobId).toBeUndefined();
  });

  it('starts on the latest tailored resume, and the Job row swaps in another', async () => {
    await renderSetup(undefined, fresh);
    // The library, then the resume it picks, then that resume's job.
    await settleChained();
    await settle(NORMAL_MS);

    // No sheet first (toreview §71): the most recently updated tailored resume is the pick.
    expect(screen.getByRole('header', { name: 'Cover letter for this job' })).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Job: Lead UX Designer, Google/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Resume: UX Designer Resume/)).toBeOnTheScreen();

    await act(async () => void fireEvent.press(screen.getByLabelText(/^Job: /)));
    await settle(NORMAL_MS);
    expect(
      screen.getByLabelText('Lead UX Designer · Google, Resume: UX Designer Resume', hidden),
    ).toBeSelected();
    await press('Senior Product Designer · Stripe, Resume: Stripe — Senior PD');
    await press('Continue');

    expect(mockSetParams).toHaveBeenCalledWith({ resumeId: 'res_2' });
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('says there is nothing to write from yet, and points to Jobs', async () => {
    const withoutJobs: Resume[] = resumesFixture.filter((resume) => resume.linkedJobId == null);
    await renderSetup(undefined, (client) => {
      client.setQueryData(qk.resumes.list(), withoutJobs);
      fresh(client);
    });
    await settle(NORMAL_MS);

    expect(screen.getByText('No tailored resumes yet')).toBeOnTheScreen();
    expect(screen.getByLabelText('Write my cover letter')).toBeDisabled();

    await act(async () => void fireEvent.press(screen.getByLabelText('Find a job to tailor for')));
    expect(mockNavigate).toHaveBeenCalledWith('/(tabs)/jobs');
  });
});
