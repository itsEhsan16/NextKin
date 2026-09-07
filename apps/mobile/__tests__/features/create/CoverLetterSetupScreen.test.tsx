import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { resumesFixture, subscriptionFixture, useMockModeStore } from '@/data/mock';
import type { Generation, Resume, Subscription } from '@/data/models';
import { createQueryClient, qk } from '@/data/queries';
import { resetMockRepos } from '@/data/repos';
import { CoverLetterSetupScreen } from '@/features/create';
import { coverLetterSources, pickCoverLetterSource } from '@/features/create/coverLetterSetup';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    navigate: jest.fn(),
    back: mockBack,
    replace: mockReplace,
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

async function renderSetup(seed?: (client: QueryClient) => void) {
  const queryClient = createQueryClient();
  clients.push(queryClient);
  seed?.(queryClient);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>
        <CoverLetterSetupScreen />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
  return queryClient;
}

/** Mock repos resolve on (fake) timers: lists ≤ 900ms, starting a run a little longer. */
const settle = (ms: number) => act(() => jest.advanceTimersByTimeAsync(ms));
const NORMAL_MS = 1000;
const START_MS = 2000;

describe('coverLetterSources (V2 §7.10)', () => {
  it('keeps only ready resumes that carry a linked job', () => {
    const sources = coverLetterSources(resumesFixture);

    // A cover letter is not a source for another cover letter.
    expect(sources.some((resume) => resume.docType === 'cover_letter')).toBe(false);
    // The base resume has no linked job, so a letter written from it would address nobody.
    expect(sources.some((resume) => resume.id === 'res_base')).toBe(false);
    // A run still in flight has no finished version to write from.
    expect(sources.some((resume) => resume.status !== 'ready')).toBe(false);
    expect(sources.map((resume) => resume.id)).toContain('res_1');
  });

  it('prefers the requested resume and falls back to the most recent candidate', () => {
    const sources = coverLetterSources(resumesFixture);

    expect(pickCoverLetterSource(sources, 'res_2')?.id).toBe('res_2');
    // An id that no longer qualifies is not honoured — the list's own order decides instead.
    expect(pickCoverLetterSource(sources, 'res_base')?.id).toBe(sources[0]?.id);
    expect(pickCoverLetterSource([], 'res_2')).toBeUndefined();
  });
});

describe('CoverLetterSetupScreen (V2 §7.10 — no artboard)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
    mockPush.mockClear();
    mockReplace.mockClear();
    mockBack.mockClear();
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
    await renderSetup();
    expect(screen.getByLabelText('Loading cover letter setup')).toBeOnTheScreen();
    // The bar is pinned while loading too — it owns the bottom safe-area inset, so the viewport
    // must not change size when the queries land.
    expect(screen.getByLabelText('Write cover letter')).toBeDisabled();

    await settle(NORMAL_MS);

    expect(screen.getByRole('header', { name: 'Write a cover letter' })).toBeOnTheScreen();

    // §13.5: the cap is on screen before the work, not after it is refused — and it is said ONCE.
    // The banner owns that line; repeating it on the bar would announce it twice.
    expect(screen.getAllByText('0 of 1 cover letter left this month')).toHaveLength(1);
    expect(
      screen.getByText("You've used this month's 1 cover letter. Pro raises the monthly cap."),
    ).toBeOnTheScreen();

    // The upsell REPLACES the action rather than interrupting the page with an alert.
    expect(screen.queryByLabelText('Write cover letter')).toBeNull();
    await act(async () => fireEvent.press(screen.getByLabelText('See Pro plans')));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/upgrade',
      params: { reason: 'cover_letters' },
    });
  });

  it('writes a letter from the chosen resume in the chosen tone', async () => {
    const client = await renderSetup((queryClient) =>
      queryClient.setQueryData(qk.user.subscription(), freshSubscription),
    );
    await settle(NORMAL_MS);

    // res_1 is the most recently updated tailored resume with a linked job.
    expect(screen.getByLabelText('Written from UX Designer Resume')).toBeOnTheScreen();
    expect(screen.getByText('Tailored · Google · Lead UX Designer')).toBeOnTheScreen();

    // Every tone carries the model's own §7.10 hint; Professional is the default.
    expect(screen.getByText('Measured and formal — the safe default')).toBeOnTheScreen();
    expect(screen.getByText('Leads with results and claims them')).toBeOnTheScreen();
    expect(screen.getByText('Warmer, closer to how you talk')).toBeOnTheScreen();
    expect(screen.getByText('Three short paragraphs, nothing spare')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Professional' })).toBeSelected();

    await act(async () => fireEvent.press(screen.getByRole('radio', { name: 'Confident' })));
    expect(screen.getByRole('radio', { name: 'Confident' })).toBeSelected();

    await act(async () => fireEvent.press(screen.getByLabelText('Write cover letter')));
    await settle(START_MS);

    const started = client.getQueryData<Generation>(qk.generations.active());
    expect(started?.kind).toBe('cover_letter');
    expect(started?.tone).toBe('confident');
    expect(started?.jobId).toBe('job_google');

    // The intake is replaced by the run it started, and only once the run exists.
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/generations/[id]',
      params: { id: started?.id },
    });
  });

  it('sends the reader to tailoring when no resume has a linked job', async () => {
    const withoutJobs: Resume[] = resumesFixture.filter((resume) => resume.linkedJobId == null);
    await renderSetup((queryClient) => {
      queryClient.setQueryData(qk.resumes.list(), withoutJobs);
      queryClient.setQueryData(qk.user.subscription(), freshSubscription);
    });
    await settle(NORMAL_MS);

    expect(screen.getByText('Tailor a resume first')).toBeOnTheScreen();
    // §7.10: nothing offers to write a letter from nothing.
    expect(screen.queryByLabelText('Write cover letter')).toBeNull();

    await act(async () => fireEvent.press(screen.getByLabelText('Tailor a resume')));
    expect(mockPush).toHaveBeenCalledWith('/create/tailor');
  });
});
