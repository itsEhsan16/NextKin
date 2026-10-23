import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import type { CoverLetterTone, Generation } from '@/data/models';
import { useMockModeStore } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { GENERATION_TICK_MS, mockStore, repos, resetMockRepos } from '@/data/repos';
import { GenerationScreen } from '@/features/generations';
import { COVER_SAVED_NOTICE } from '@/features/generations/components/CoverRunView';
import { coverProgressRows, otherTones } from '@/features/generations/components/coverRun';
import { resetSessionExports } from '@/features/generations/hooks/sessionExports';
import { renderPdf, shareFile } from '@/lib';
import { useAccuracyStore } from '@/features/resumes';

// The accuracy confirmation (V2 §15 risk 2) is answered "yes" here: these tests are about the run
// screens, and ResumeExportHost.test covers the sheet itself, "not yet" included.
let stopAnswering = () => {};
beforeEach(() => {
  stopAnswering = useAccuracyStore.subscribe((state) => {
    if (state.open) queueMicrotask(() => state.answer(true));
  });
});
afterEach(() => stopAnswering());

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockDismissTo = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    navigate: jest.fn(),
    back: jest.fn(),
    replace: mockReplace,
    dismissTo: mockDismissTo,
  }),
  Link: ({ children }: PropsWithChildren) => children,
}));

// Only the device writers are stubbed; the rest of @/lib is real.
jest.mock('@/lib', () => ({
  ...jest.requireActual('@/lib'),
  renderPdf: jest.fn(),
  shareFile: jest.fn(),
}));

const mockRenderPdf = renderPdf as jest.MockedFunction<typeof renderPdf>;
const mockShareFile = shareFile as jest.MockedFunction<typeof shareFile>;

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const settle = (ms: number) => act(() => jest.advanceTimersByTimeAsync(ms));
const NORMAL_MS = 1000;
/** "Stripe — Senior PD", tailored to job_stripe. */
const SOURCE_ID = 'res_2';

/** Room for one more letter, so the seeded plan (1 of 1 spent) does not gate the start. */
function allowLetters(limit: number) {
  mockStore.state.subscription.usage.coverLettersUsed = 0;
  mockStore.state.subscription.usage.coverLettersLimit = limit;
}

/** A letter from res_2 for job_stripe through the repos, the way COVER 01's Write starts it. */
async function startCoverRun(tone: CoverLetterTone = 'professional'): Promise<string> {
  const starting = repos.generations.start({
    kind: 'cover_letter',
    sourceResumeId: SOURCE_ID,
    jobId: 'job_stripe',
    tone,
  });
  await settle(NORMAL_MS);
  return (await starting).id;
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
  await settle(NORMAL_MS);
}

async function renderReady(id: string) {
  await renderGeneration(id);
  await settle(GENERATION_TICK_MS * 9);
  await settle(NORMAL_MS);
}

describe('GenerationScreen — cover letter run (COVER 02–03, 644:84 / 644:148)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
    resetSessionExports();
    mockPush.mockClear();
    mockReplace.mockClear();
    mockDismissTo.mockClear();
    mockRenderPdf.mockReset();
    mockShareFile.mockReset();
  });

  afterEach(async () => {
    await act(() => jest.runOnlyPendingTimersAsync());
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
    jest.useRealTimers();
  });

  it('shows the writing checklist under the Write step while the run works', async () => {
    expect(mockStore.state.resumes.find((r) => r.id === SOURCE_ID)?.title).toBe(
      'Stripe — Senior PD',
    );
    allowLetters(3);
    const id = await startCoverRun();
    await renderGeneration(id);
    await settle(GENERATION_TICK_MS);

    expect(screen.getByLabelText('Step 2 of 3, Write')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Writing your cover letter' })).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Our AI is writing a personalised cover letter from your resume and the job details.',
      ),
    ).toBeOnTheScreen();
    // The five steps, whichever one the run is on (coverProgressRows pins the mapping below).
    for (const step of [
      'Read your resume and the job details',
      'Picked your strongest points',
      'Writing in a professional tone',
      'Fitting it to the role and company',
      'Finalising your cover letter',
    ]) {
      expect(screen.getByLabelText(new RegExp(`^${step}, `))).toBeOnTheScreen();
    }
    expect(
      screen.getByText('Nothing goes in the letter that isn’t on your resume.'),
    ).toBeOnTheScreen();
    // COVER 02 draws no bar: the ✕ leaves, and the run carries on without the screen.
    expect(screen.queryByLabelText('Leave and notify me')).toBeNull();

    await act(async () => fireEvent.press(screen.getByLabelText('Close')));
    expect(mockDismissTo).toHaveBeenCalledWith({
      pathname: '/jobs/[id]',
      params: { id: 'job_stripe' },
    });
  });

  it('shows the ready letter with its opening, Edit letter, and the other tones', async () => {
    allowLetters(3);
    const id = await startCoverRun();
    await renderReady(id);

    expect(screen.getByLabelText('Step 3 of 3, Download')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Your cover letter is ready!' })).toBeOnTheScreen();
    expect(
      screen.getByText('A tailored cover letter for the Senior Product Designer role at Stripe.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Cover letter for Stripe')).toBeOnTheScreen();
    const letterId = mockStore.state.generations.find((g) => g.id === id)?.resumeId ?? '';
    const letter = mockStore.state.contents[letterId];
    if (letter?.kind !== 'cover_letter') throw new Error('expected a letter body');
    expect(screen.getByText(letter.greeting)).toBeOnTheScreen();
    expect(screen.getByText(letter.paragraphs[0] ?? '')).toBeOnTheScreen();
    // An excerpt, not the document: the rest of the letter lives in the editor and the PDF.
    const second = letter.paragraphs[1];
    if (second) expect(screen.queryByText(second)).toBeNull();
    expect(screen.queryByText('Professional')).toBeNull();

    await act(async () => fireEvent.press(screen.getByLabelText('Edit letter')));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/resumes/[id]', params: { id: letterId } });

    // A new tone is a new run in place of this screen; the first letter stays in Resumes.
    await act(async () => fireEvent.press(screen.getByLabelText('Write it in a confident tone')));
    await settle(NORMAL_MS);
    const next = mockStore.state.generations.find((g) => g.id !== id && g.tone === 'confident');
    expect(next?.kind).toBe('cover_letter');
    expect(next?.sourceResumeId).toBe(SOURCE_ID);
    expect(next?.jobId).toBe('job_stripe');
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/generations/[id]',
      params: { id: next?.id },
    });
    expect(mockStore.state.resumes.some((r) => r.id === letterId)).toBe(true);
  });

  it('routes a tone chip to the plans when the allowance is spent', async () => {
    allowLetters(1);
    const id = await startCoverRun();
    await renderReady(id);
    const runs = mockStore.state.generations.length;

    await act(async () => fireEvent.press(screen.getByLabelText('Write it in a concise tone')));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/upgrade',
      params: { reason: 'cover_letters' },
    });
    expect(mockStore.state.generations).toHaveLength(runs);
  });

  it('downloads the letter in one tap and says it was saved', async () => {
    allowLetters(3);
    const id = await startCoverRun();
    await renderReady(id);

    mockRenderPdf.mockResolvedValueOnce({ uri: 'file:///cache/letter.pdf', name: 'letter.pdf' });
    mockShareFile.mockResolvedValue('done');
    await act(async () => fireEvent.press(screen.getByLabelText('Download PDF')));
    // Refused for confirmation, confirmed, exported again: three simulated calls in a row.
    await settle(NORMAL_MS * 3);

    expect(mockShareFile).toHaveBeenCalledTimes(1);
    expect(screen.getByText(COVER_SAVED_NOTICE)).toBeOnTheScreen();
  });
});

describe('coverProgressRows', () => {
  const base = { ...mockStore.state.generations[0]!, kind: 'cover_letter' as const };
  const current = (status: Generation['status'], progress: number) =>
    coverProgressRows({ ...base, jobId: 'job_stripe', status, progress }).findIndex(
      (row) => row.state === 'current',
    );

  it('writes in the run’s tone while the draft is validated (the board’s 70%)', () => {
    const rows = coverProgressRows({
      ...base,
      jobId: 'job_stripe',
      status: 'validating',
      progress: 0.7,
      tone: 'concise',
    });
    expect(rows.map((row) => row.label)[2]).toBe('Writing in a concise tone');
    expect(rows.map((row) => row.state)).toEqual(['done', 'done', 'current', 'todo', 'todo']);
  });

  it('gives each of the five steps its turn as the run moves', () => {
    expect(current('queued', 0)).toBe(0);
    expect(current('generating', 0.15)).toBe(0);
    expect(current('generating', 0.3)).toBe(1);
    expect(current('validating', 0.6)).toBe(2);
    expect(current('scoring', 0.75)).toBe(3);
    expect(current('scoring', 0.9)).toBe(4);
    expect(
      coverProgressRows({ ...base, status: 'ready', progress: 1 }).every(
        (row) => row.state === 'done',
      ),
    ).toBe(true);
  });

  it('reads the resume alone when the letter has no job', () => {
    const labels = coverProgressRows({ ...base, jobId: undefined, status: 'queued' }).map(
      (row) => row.label,
    );
    expect(labels[0]).toBe('Read your resume');
    expect(labels[3]).toBe('Fitting it to the role');
  });

  it('offers the three tones the draft is not in', () => {
    expect(otherTones('professional')).toEqual(['confident', 'conversational', 'concise']);
  });
});
