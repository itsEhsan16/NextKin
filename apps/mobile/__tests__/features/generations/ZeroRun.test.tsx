import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { GENERATION_TICK_MS, mockStore, repos, resetMockRepos } from '@/data/repos';
import { GenerationScreen } from '@/features/generations';
import { zeroProgressRows } from '@/features/generations/components/zeroRun';
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

/** Sheet content enters on a fade the Reanimated mock leaves at opacity 0. */
const hidden = { includeHiddenElements: true } as const;
const settle = (ms: number) => act(() => jest.advanceTimersByTimeAsync(ms));
const NORMAL_MS = 1000;

const SEED = {
  fullName: 'George Smith',
  yearsBand: '6-10' as const,
  yearsExperience: 8,
  targetTitle: 'Product Designer',
};

async function startZeroRun(): Promise<string> {
  const starting = repos.generations.start({ kind: 'zero_resume', zero: SEED });
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

const press = (label: string) =>
  act(async () => void fireEvent.press(screen.getByLabelText(label, hidden)));

describe('GenerationScreen — Zero Resume run (ZERO 02–05)', () => {
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

  it('writes the draft under the Draft step, in the seed’s own words', async () => {
    const id = await startZeroRun();
    await renderGeneration(id);

    expect(screen.getByLabelText('Step 3 of 3')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Writing your first draft' })).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Looked at Product Designer roles, /)).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Planned sections for 6–10 years, /)).toBeOnTheScreen();
    expect(
      screen.getByText('Anything we can’t know stays as a [blank] for you to fill in.'),
    ).toBeOnTheScreen();

    // Leaving keeps the run going; with no job it is a plain back.
    await press('Leave and notify me');
    expect(mockBack).toHaveBeenCalled();
  });

  it('checks every guess, then opens the download', async () => {
    const id = await startZeroRun();
    await renderGeneration(id);
    await settle(GENERATION_TICK_MS * 9);
    await settle(NORMAL_MS);

    // ZERO 03: the marked draft and the four kinds of guess.
    expect(screen.getByLabelText('Step 3 of 3')).toBeOnTheScreen();
    expect(
      screen.getByRole('header', { name: 'Your draft is ready. Check 9 things' }),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Checked 0 of 9')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Roles and dates · 3, The titles and years are our guesses'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Download unlocks when all 9 are checked')).toBeOnTheScreen();
    expect(screen.getByLabelText('Download')).toBeDisabled();

    // ZERO 04: the first role, its company blank and already in error.
    await press('Start checking');
    expect(screen.getByText('Is this role right?', hidden)).toBeOnTheScreen();
    expect(screen.getByText('1 of 9 · Roles and dates', hidden)).toBeOnTheScreen();
    expect(screen.getByText('Add the real company — a blank can’t stay', hidden)).toBeOnTheScreen();
    await press('Save and next');
    expect(screen.getByText('1 of 9 · Roles and dates', hidden)).toBeOnTheScreen();

    await act(async () =>
      fireEvent.changeText(screen.getByLabelText('Company', hidden), 'Flipkart'),
    );
    await press('Save and next');
    await settle(NORMAL_MS);
    expect(screen.getByText('3 of 9 · Roles and dates', hidden)).toBeOnTheScreen();

    // The other two roles go; both skills are kept; the school is filled in.
    await press('Delete this role');
    await settle(NORMAL_MS);
    await press('Delete this role');
    await settle(NORMAL_MS);
    expect(screen.getByText('Do you have this skill?', hidden)).toBeOnTheScreen();
    await press('Save and next');
    await settle(NORMAL_MS);
    await press('Save and next');
    await settle(NORMAL_MS);
    expect(screen.getByText('Where did you study?', hidden)).toBeOnTheScreen();
    await act(async () => fireEvent.changeText(screen.getByLabelText('Degree', hidden), 'B.Des'));
    await act(async () =>
      fireEvent.changeText(screen.getByLabelText('School', hidden), 'NID Ahmedabad'),
    );
    await press('Save and next');
    await settle(NORMAL_MS);

    // ZERO 05: every step ticked, what was checked, and the download open.
    expect(screen.getByLabelText('Step 3 of 3')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Your first resume is ready' })).toBeOnTheScreen();
    expect(screen.getByText('All 9 checked')).toBeOnTheScreen();
    expect(screen.getByText('Saved to your profile too')).toBeOnTheScreen();
    expect(screen.getByLabelText('1 role: titles and dates confirmed, done')).toBeOnTheScreen();
    expect(screen.getByLabelText('2 roles removed, done')).toBeOnTheScreen();
    expect(screen.getByLabelText('2 skills confirmed, done')).toBeOnTheScreen();
    expect(screen.getByText('Next: tailor it to a job you want to apply for')).toBeOnTheScreen();
    expect(screen.getByLabelText('Download PDF')).toBeEnabled();

    const resumeId = mockStore.state.generations.find((g) => g.id === id)?.resumeId ?? '';
    await press('Edit');
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/resumes/[id]', params: { id: resumeId } });
  });
});

describe('zeroProgressRows', () => {
  const base = { ...mockStore.state.generations[0]!, kind: 'zero_resume' as const, zero: SEED };

  it('is writing the experience at the board’s 48%', () => {
    const rows = zeroProgressRows({ ...base, status: 'generating', progress: 0.48 });
    expect(rows.map((row) => row.state)).toEqual(['done', 'done', 'current', 'todo']);
  });

  it('writes a summary and skills for someone starting out', () => {
    const rows = zeroProgressRows({
      ...base,
      zero: { ...SEED, yearsBand: 'none', yearsExperience: 0 },
      status: 'queued',
      progress: 0,
    });
    expect(rows.map((row) => row.label)).toEqual([
      'Looked at Product Designer roles',
      'Planned the sections of a first resume',
      'Writing your summary and skills',
      'Marking what you need to check',
    ]);
  });
});
