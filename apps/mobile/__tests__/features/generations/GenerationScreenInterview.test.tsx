import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import type { Generation } from '@/data/models';
import { createQueryClient } from '@/data/queries';
import { GENERATION_TICK_MS, mockStore, repos, resetMockRepos } from '@/data/repos';
import { GenerationScreen } from '@/features/generations';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, navigate: jest.fn(), back: jest.fn(), replace: mockReplace }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const settle = (ms: number) => act(() => jest.advanceTimersByTimeAsync(ms));
const NORMAL_MS = 1000;
/** A fresh run starts at 0 and gains 0.15 a tick; seven ticks land on ready. */
const TO_READY = GENERATION_TICK_MS * 8;

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
}

/** Starts an interview run the way the setup screen does, resolved on fake timers. */
async function startInterviewRun(): Promise<Generation> {
  const started = repos.generations.start({
    kind: 'interview',
    sourceResumeId: 'res_1',
    jobId: 'job_google',
  });
  await settle(NORMAL_MS);
  return started;
}

describe('GenerationScreen — an interview run (V2 §7.15)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
    mockPush.mockClear();
    mockReplace.mockClear();
  });

  afterEach(async () => {
    await act(() => jest.runOnlyPendingTimersAsync());
    await cleanup();
    jest.clearAllTimers();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
    jest.useRealTimers();
  });

  it('finishes on the practice set it wrote, not on a document', async () => {
    const run = await startInterviewRun();
    await renderGeneration(run.id);
    await settle(NORMAL_MS);

    // Still running: no destination is offered yet, and none of them is a resume.
    expect(screen.queryByLabelText('Start practising')).toBeNull();
    expect(screen.queryByLabelText('Open resume')).toBeNull();

    await settle(TO_READY);
    await settle(NORMAL_MS);

    const set = mockStore.state.interviewSets.find((item) => item.generationId === run.id);
    expect(set).toBeDefined();
    // The set was written from the resume ∩ its job: every technical question names a claimed skill.
    expect(set?.source).toBe('resume');
    expect(set?.resumeId).toBe('res_1');
    expect(set?.questions.length).toBeGreaterThanOrEqual(10);

    expect(screen.getByLabelText('Start practising')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Open resume')).toBeNull();
    expect(screen.queryByLabelText('View score')).toBeNull();

    await act(async () => fireEvent.press(screen.getByLabelText('Start practising')));
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/interview/[id]',
      params: { id: set?.id },
    });
  });

  it('falls back to the library when the set the run wrote has since been deleted', async () => {
    const run = await startInterviewRun();
    await renderGeneration(run.id);
    await settle(NORMAL_MS);
    await settle(TO_READY);
    await settle(NORMAL_MS);
    expect(screen.getByLabelText('Start practising')).toBeOnTheScreen();

    // Deleted between the run finishing and the reader coming back to this screen — a fresh
    // mount with a fresh cache, the way a return from the library would be.
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    mockStore.state.interviewSets = mockStore.state.interviewSets.filter(
      (item) => item.generationId !== run.id,
    );
    await renderGeneration(run.id);
    // Two settles, not one: the set lookup is enabled by the run's arrival, which lands after the
    // first act scope flushes — the same shape as the ready path above.
    await settle(NORMAL_MS * 2);
    await settle(NORMAL_MS * 2);

    expect(screen.queryByLabelText('Start practising')).toBeNull();
    await act(async () => fireEvent.press(screen.getByLabelText('Back to Interview prep')));
    expect(mockReplace).toHaveBeenCalledWith('/interview');
  });
});
