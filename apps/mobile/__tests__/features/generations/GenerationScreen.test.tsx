import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { GENERATION_TICK_MS, resetMockRepos } from '@/data/repos';
import { GenerationScreen } from '@/features/generations';

const mockPush = jest.fn();
const mockNavigate = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, navigate: mockNavigate, back: jest.fn(), replace: jest.fn() }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

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

/** Mock repos resolve on (fake) timers: "normal" is ≤ 900ms per request. */
const settle = (ms: number) => act(() => jest.advanceTimersByTimeAsync(ms));
const NORMAL_MS = 1000;

describe('GenerationScreen (V2 §7.6)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
    mockPush.mockClear();
    mockNavigate.mockClear();
  });

  afterEach(async () => {
    // Flush in-flight mock requests BEFORE unmounting: a late React Query update during teardown
    // starts an act() scope that overlaps the next test's, wedging React's act queue. Unmounting
    // then unsubscribes the run, which is what stops the repo's ticker.
    await act(() => jest.runOnlyPendingTimersAsync());
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
    jest.useRealTimers();
  });

  it('shows the five pipeline steps with the run standing on one of them', async () => {
    await renderGeneration('gen_active');
    await settle(NORMAL_MS);

    // The fixture sits mid-flight at 0.45 — "generating": one step behind it, three ahead.
    expect(screen.getByLabelText('Generating, 45% complete')).toBeOnTheScreen();
    expect(screen.getByLabelText('Queued, done')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Generating, in progress. Tailoring your resume to the role'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Validating, waiting')).toBeOnTheScreen();
    expect(screen.getByLabelText('Scoring, waiting')).toBeOnTheScreen();
    expect(screen.getByLabelText('Ready, waiting')).toBeOnTheScreen();

    expect(
      screen.getByText(
        "You can leave this screen — we'll keep going and tell you when it's ready.",
      ),
    ).toBeOnTheScreen();
  });

  it('runs through to ready and offers the score and the document', async () => {
    await renderGeneration('gen_active');
    await settle(NORMAL_MS);

    // 0.45 + 0.15 a tick: four ticks land on 1.0, which is where `ready` and its document are.
    await settle(GENERATION_TICK_MS * 5);
    // The finished run refetches the document it filled, so the ring has a score to count to.
    await settle(NORMAL_MS);

    // Every step is behind the run now, and the hero says so in the pipeline's own words.
    expect(screen.getByLabelText('Ready, done')).toBeOnTheScreen();
    expect(screen.getByText('Your resume is ready to review')).toBeOnTheScreen();
    expect(
      screen.queryByText(
        "You can leave this screen — we'll keep going and tell you when it's ready.",
      ),
    ).toBeNull();

    expect(screen.getByLabelText('View score')).toBeOnTheScreen();
    expect(screen.getByLabelText('Open resume')).toBeOnTheScreen();

    await act(async () => fireEvent.press(screen.getByLabelText('View score')));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/resumes/[id]/score',
      params: { id: 'res_6' },
    });
  });

  it('shows a failed run its reason and a retry that actually restarts it', async () => {
    await renderGeneration('gen_failed_1');
    await settle(NORMAL_MS);

    // StateView hides the message node from the a11y tree (the title carries title + message as
    // one summary), and RNTL skips hidden elements, so the reason is read off that summary.
    expect(screen.getByText('Generation failed')).toBeOnTheScreen();
    expect(
      screen.getByLabelText(
        'Generation failed. The job description could not be parsed. Try pasting it manually.',
      ),
    ).toBeOnTheScreen();

    await act(async () => fireEvent.press(screen.getByLabelText('Try again')));
    await settle(NORMAL_MS);

    // Back at the head of the pipeline with the failure cleared — §7.6's "working retry".
    expect(screen.queryByText('Generation failed')).toBeNull();
    expect(screen.getByLabelText('Queued, in progress. Waiting for a free slot')).toBeOnTheScreen();
  });
});
