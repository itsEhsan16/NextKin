import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import type { JdInput, TailorChoices } from '@/data/models';
import { useMockModeStore } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { GENERATION_TICK_MS, mockStore, repos, resetMockRepos } from '@/data/repos';
import { GenerationScreen } from '@/features/generations';
import { buildBandLabel, buildBand } from '@/features/generations/components/buildRun';
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
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    navigate: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
    dismissTo: mockDismissTo,
  }),
  Link: ({ children }: PropsWithChildren) => children,
}));

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

const hidden = { includeHiddenElements: true } as const;
const settle = (ms: number) => act(() => jest.advanceTimersByTimeAsync(ms));
const NORMAL_MS = 1000;

const PASTED =
  'Product Designer\n\nWe are hiring a product designer. Requirements: Figma, prototyping, ' +
  'user research and design systems.';

/** Home's Build Resume: read the job, then start a build from the profile. */
async function startBuild(
  input: JdInput,
  jobId?: string,
  build?: TailorChoices,
): Promise<{ id: string; jdId: string }> {
  const extracting = repos.jd.extract(input);
  await settle(3000);
  const { id: jdId } = await extracting;
  const starting = repos.generations.start({
    kind: 'resume',
    jdId,
    ...(jobId ? { jobId } : {}),
    ...(build ? { build } : {}),
    origin: 'build',
  });
  await settle(NORMAL_MS);
  return { id: (await starting).id, jdId };
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

async function finish() {
  await settle(GENERATION_TICK_MS * 9);
  await settle(NORMAL_MS);
}

describe('GenerationScreen — Build Resume run (BUILD 05–07)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
    mockPush.mockClear();
    mockDismissTo.mockClear();
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

  it('shows the build checklist with only the ✕ while the run works', async () => {
    const { id } = await startBuild({ source: 'job', jobId: 'job_cred' }, 'job_cred');
    await renderGeneration(id);
    await settle(GENERATION_TICK_MS);

    expect(screen.queryByLabelText(/^Step \d of \d/)).toBeNull();
    expect(screen.getByText('Building for CRED')).toBeOnTheScreen();
    expect(
      screen.getByText('Matching your experience to the job.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Almost there')).toBeOnTheScreen();
    expect(screen.getByLabelText('Read the job description, done')).toBeOnTheScreen();
    // The matching is a step of its own, seen working before the writing starts.
    expect(screen.getByLabelText('Matched your experience, in progress')).toBeOnTheScreen();
    expect(screen.getByLabelText('Writing your resume, waiting')).toBeOnTheScreen();

    await settle(GENERATION_TICK_MS);
    expect(screen.getByLabelText('Matched your experience, done')).toBeOnTheScreen();
    expect(screen.getByLabelText('Writing your resume, in progress')).toBeOnTheScreen();
    expect(screen.getByLabelText('Checking the ATS score, waiting')).toBeOnTheScreen();

    await act(async () => fireEvent.press(screen.getByText('Leave and notify me')));
    expect(mockDismissTo).toHaveBeenCalledWith({
      pathname: '/jobs/[id]',
      params: { id: 'job_cred' },
    });
  });

  it('lands on the ready screen with the band pill, the way to what changed and the next steps', async () => {
    const { id } = await startBuild({ source: 'job', jobId: 'job_cred' }, 'job_cred');
    await renderGeneration(id);
    await finish();

    const generation = mockStore.state.generations.find((g) => g.id === id);
    const resumeId = generation?.resumeId ?? '';
    const score = mockStore.state.resumes.find((r) => r.id === resumeId)?.atsScore ?? 0;
    expect(screen.getByText('Your resume for CRED is ready')).toBeOnTheScreen();
    expect(screen.getByText(buildBandLabel(buildBand(score)))).toBeOnTheScreen();
    expect(screen.queryByText(/^Up from/)).toBeNull();
    expect(screen.getByText('Saved to Resumes')).toBeOnTheScreen();

    await act(async () => fireEvent.press(screen.getByLabelText('Cover letter for this job')));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/create/cover-letter',
      params: { resumeId },
    });
    await act(async () => fireEvent.press(screen.getByLabelText('Practice the interview')));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/interview/new', params: { resumeId } });
    // The list moved to the Versions page: the finished screen keeps one way there (§146.5).
    await act(async () => fireEvent.press(screen.getByLabelText('See what changed')));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/resumes/[id]/versions',
      params: { id: resumeId },
    });

    // BUILD 07: Download PDF raises the app's download sheet; its PDF row hands the file over.
    mockRenderPdf.mockResolvedValue({ uri: 'file:///cache/built.pdf', name: 'built.pdf' });
    mockShareFile.mockResolvedValue('done');
    await act(async () => fireEvent.press(screen.getByLabelText('Download PDF')));
    await settle(NORMAL_MS);
    expect(screen.getByLabelText('Export as DOCX, Pro feature', hidden)).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByLabelText('Export as PDF', hidden)));
    // Refused for confirmation, confirmed, exported again: three simulated calls in a row.
    await settle(NORMAL_MS * 3);

    expect(mockShareFile).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Saved as PDF', hidden)).toBeOnTheScreen();
  });

  it('keeps what the user answered on BUILD 04c on the run', async () => {
    const { id } = await startBuild({ source: 'job', jobId: 'job_cred' }, 'job_cred', {
      added: ['Fintech'],
      skipped: ['Payments'],
    });
    await renderGeneration(id);
    await finish();

    expect(mockStore.state.generations.find((g) => g.id === id)?.build).toEqual({
      added: ['Fintech'],
      skipped: ['Payments'],
    });
  });

  it('builds for a pasted job without a letter tile, an Apply button or a job to return to', async () => {
    const { id } = await startBuild({ source: 'paste', text: PASTED });
    await renderGeneration(id);
    await finish();

    expect(screen.queryByLabelText('Cover letter for this job')).toBeNull();
    expect(screen.getByLabelText('Practice the interview')).toBeOnTheScreen();

    await act(async () => fireEvent.press(screen.getByLabelText('Close')));
    expect(mockDismissTo).toHaveBeenCalledWith('/(tabs)');

    await act(async () => fireEvent.press(screen.getByLabelText('Download PDF')));
    await settle(NORMAL_MS);
    expect(screen.getByLabelText('Export as PDF', hidden)).toBeOnTheScreen();
    expect(screen.queryByLabelText(/^Apply on /, hidden)).toBeNull();
  });
});
