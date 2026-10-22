import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import type { TailorRun } from '@/data/models';
import { useMockModeStore } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { GENERATION_TICK_MS, mockStore, repos, resetMockRepos } from '@/data/repos';
import { GenerationScreen } from '@/features/generations';
import { tailorProgressRows } from '@/features/generations/components/TailorProgress';
import { siteHost } from '@/features/generations/components/TailorRunView';
import { openExternalUrl, renderPdf, shareFile } from '@/lib';
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
const mockDismissTo = jest.fn();
const mockReplace = jest.fn();
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

// Only the device writers and the browser are stubbed; the rest of @/lib is real.
jest.mock('@/lib', () => ({
  ...jest.requireActual('@/lib'),
  renderPdf: jest.fn(),
  shareFile: jest.fn(),
  openExternalUrl: jest.fn(),
}));

const mockRenderPdf = renderPdf as jest.MockedFunction<typeof renderPdf>;
const mockShareFile = shareFile as jest.MockedFunction<typeof shareFile>;
const mockOpenUrl = openExternalUrl as jest.MockedFunction<typeof openExternalUrl>;

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** Sheet content enters on a fade the Reanimated mock leaves at opacity 0. */
const hidden = { includeHiddenElements: true } as const;
const settle = (ms: number) => act(() => jest.advanceTimersByTimeAsync(ms));
const NORMAL_MS = 1000;

const TAILOR: TailorRun = {
  sourceResumeId: 'res_base',
  baselineScore: 72,
  sourcePages: 3,
  added: ['Merchant onboarding', 'Usability testing'],
  skipped: ['Fintech / payments'],
};

/** res_base × job_stripe through the repos, the way TAILOR 03's Create my resume starts it. */
async function startTailorRun(tailor: TailorRun = TAILOR): Promise<string> {
  const comparing = repos.jd.compare('res_base', 'job_stripe');
  await settle(3000);
  const { jdId } = await comparing;
  const starting = repos.generations.start({
    kind: 'resume',
    jdId,
    jobId: 'job_stripe',
    baseResumeId: 'res_base',
    tailor,
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

describe('GenerationScreen — job-first tailoring run (TAILOR 04–06)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
    mockPush.mockClear();
    mockDismissTo.mockClear();
    mockReplace.mockClear();
    mockRenderPdf.mockReset();
    mockShareFile.mockReset();
    mockOpenUrl.mockReset();
  });

  afterEach(async () => {
    await act(() => jest.runOnlyPendingTimersAsync());
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
    jest.useRealTimers();
  });

  it('shows the tailoring checklist under the Fix step while the run works', async () => {
    const id = await startTailorRun();
    await renderGeneration(id);
    // The job loads after the run, and one tick moves the run off the queue.
    await settle(GENERATION_TICK_MS);

    expect(screen.getByLabelText('Step 2 of 3, Fix')).toBeOnTheScreen();
    expect(screen.getByText('Tailoring your resume for Stripe')).toBeOnTheScreen();
    expect(screen.getByLabelText('Added the 2 skills you chose, done')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Rewriting your headline and summary, in progress'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Checking the ATS score, waiting')).toBeOnTheScreen();
    expect(screen.getByText('Leave and notify me')).toBeOnTheScreen();

    // ✕ leaves the whole flow, back to the job it started from.
    await act(async () => fireEvent.press(screen.getByLabelText('Close')));
    expect(mockDismissTo).toHaveBeenCalledWith({
      pathname: '/jobs/[id]',
      params: { id: 'job_stripe' },
    });
  });

  it('lands on the ready screen with the score rise and only the changes the run made', async () => {
    const id = await startTailorRun();
    await renderGeneration(id);
    await settle(GENERATION_TICK_MS * 9);
    await settle(NORMAL_MS);

    expect(screen.getByLabelText('Step 3 of 3, Download')).toBeOnTheScreen();
    expect(screen.getByText('Your resume for Stripe is ready')).toBeOnTheScreen();
    const generation = mockStore.state.generations.find((g) => g.id === id);
    const score = mockStore.state.resumes.find((r) => r.id === generation?.resumeId)?.atsScore;
    expect(score).toBeGreaterThan(72);
    expect(screen.getByText('Up from 72')).toBeOnTheScreen();
    expect(screen.getByText('Saved to Resumes')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Added merchant onboarding and usability testing, done'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Trimmed from 3 pages to 2, done')).toBeOnTheScreen();
    expect(screen.getByLabelText('Fintech left out, as you chose, left out')).toBeOnTheScreen();
    expect(screen.getByText('Next: download it, then apply on stripe.com')).toBeOnTheScreen();

    // Download → the file goes to the share sheet → TAILOR 06 names it and links out.
    mockRenderPdf.mockResolvedValue({ uri: 'file:///cache/tailored.pdf', name: 'tailored.pdf' });
    mockShareFile.mockResolvedValue('done');
    mockOpenUrl.mockResolvedValue('done');
    await act(async () => fireEvent.press(screen.getByLabelText('Download PDF')));
    // Refused for confirmation, confirmed, exported again: three simulated calls in a row.
    await settle(NORMAL_MS * 3);

    expect(mockShareFile).toHaveBeenCalledTimes(1);
    expect(screen.getByText('tailored.pdf', hidden)).toBeOnTheScreen();
    expect(screen.getByText('Saved. Now apply on Stripe’s site', hidden)).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByLabelText('Apply on stripe.com', hidden)));
    expect(mockOpenUrl).toHaveBeenCalledWith('https://stripe.com');
  });

  it('says to verify the email in place, with a resend and the retry (toreview §114)', async () => {
    const id = await startTailorRun();
    await renderGeneration(id);
    await settle(GENERATION_TICK_MS * 9);
    await settle(NORMAL_MS);

    mockStore.state.user = { ...mockStore.state.user, emailVerified: false };
    await act(async () => fireEvent.press(screen.getByLabelText('Download PDF')));
    await settle(NORMAL_MS * 3);

    expect(
      screen.getByText('Verify your email address before your first download.'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Try again')).toBeOnTheScreen();
    expect(mockShareFile).not.toHaveBeenCalled();
  });

  it('sends a failed tailoring run back to Customize for the same job and resume', async () => {
    const id = await startTailorRun();
    mockStore.state.generations = mockStore.state.generations.map((g) =>
      g.id === id ? { ...g, status: 'failed', error: 'It stopped.' } : g,
    );
    await renderGeneration(id);

    await act(async () => fireEvent.press(screen.getByLabelText('Change my choices')));
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/create/tailor',
      params: { jobId: 'job_stripe', resumeId: 'res_base' },
    });
  });

  it('keeps the generic progress screen for a run without a tailor record', async () => {
    await renderGeneration('gen_active');

    expect(screen.getByLabelText('Queued, done')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Step 2 of 3, Fix')).toBeNull();
    expect(screen.queryByText('Leave and notify me')).toBeNull();
  });
});

describe('tailorProgressRows', () => {
  const base = { ...mockStore.state.generations[0]!, tailor: TAILOR };

  it('omits the skills row when nothing was added', () => {
    const rows = tailorProgressRows({
      ...base,
      status: 'generating',
      tailor: { ...TAILOR, added: [] },
    });
    expect(rows.map((row) => row.label)).toEqual([
      'Compared it with the job',
      'Rewriting your headline and summary',
      'Checking the ATS score',
    ]);
    expect(rows.map((row) => row.state)).toEqual(['done', 'current', 'todo']);
  });

  it('moves to the ATS check once the draft is being validated', () => {
    const rows = tailorProgressRows({ ...base, status: 'validating' });
    expect(rows.map((row) => row.state)).toEqual(['done', 'done', 'done', 'current']);
  });
});

describe('siteHost', () => {
  it('reduces a website to the host the copy names', () => {
    expect(siteHost('stripe.com')).toBe('stripe.com');
    expect(siteHost('https://www.stripe.com/jobs?x=1')).toBe('stripe.com');
  });
});
