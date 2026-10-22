import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import { INTERVIEW_DISCLAIMER } from '@/data/models';
import { createQueryClient } from '@/data/queries';
import { mockStore, resetMockRepos } from '@/data/repos';
import { InterviewPracticeScreen, useInterviewStore } from '@/features/interview';

const mockNavigate = jest.fn();
const mockBack = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    navigate: mockNavigate,
    back: mockBack,
    replace: jest.fn(),
  }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** Disclosure bodies and segments animate; the Reanimated mock leaves entering nodes hidden. */
const shown = { includeHiddenElements: true } as const;

/** Mock repos resolve on (fake) timers: "normal" is ≤ 900ms per request. */
const settle = (ms: number) => act(() => jest.advanceTimersByTimeAsync(ms));
const NORMAL_MS = 1000;
const SET_ID = 'int_stripe';

const seeded = () => {
  const set = mockStore.state.interviewSets.find((item) => item.id === SET_ID);
  if (!set) throw new Error('fixture: the Stripe set is missing');
  return set;
};

async function renderPractice(id = SET_ID) {
  const queryClient = createQueryClient();
  clients.push(queryClient);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>
        <InterviewPracticeScreen id={id} />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

describe('InterviewPracticeScreen (V2 §7.15, INTERVIEW 04 / 05)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
    useInterviewStore.setState({ filter: 'all', filterSnapshot: {} });
    mockNavigate.mockClear();
    mockBack.mockClear();
  });

  afterEach(async () => {
    await act(() => jest.runOnlyPendingTimersAsync());
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
    jest.useRealTimers();
  });

  it('opens on the first question with the answer hidden, and reveals it on request', async () => {
    await renderPractice();
    expect(screen.getByLabelText('Next')).toBeDisabled();

    await settle(NORMAL_MS);

    const set = seeded();
    const first = set.questions[0];
    if (!first) throw new Error('fixture: empty set');
    expect(screen.getByRole('header', { name: set.title })).toBeOnTheScreen();
    expect(screen.getByText(`Question 1 of ${set.questions.length}`, shown)).toBeOnTheScreen();
    // The counts are pills under the bar (INTERVIEW 04 577:3877).
    expect(screen.getByText('2 confident', shown)).toBeOnTheScreen();
    expect(screen.getByText('1 needs work', shown)).toBeOnTheScreen();
    expect(screen.getByText(`3 of ${set.questions.length} marked`, shown)).toBeOnTheScreen();
    expect(screen.getByText(first.prompt, shown)).toBeOnTheScreen();
    // §7.15: the model answer is hidden until asked for.
    expect(screen.queryByText(first.answer, shown)).toBeNull();
    // §7.15: the disclaimer is on the practice surface itself, not only on the library.
    expect(screen.getByText(INTERVIEW_DISCLAIMER, shown)).toBeOnTheScreen();
    // The first technical question names a skill the resume claims, as a chip.
    expect(first.skill).toBeDefined();
    expect(screen.getByText(first.skill ?? '', shown)).toBeOnTheScreen();

    await act(async () => fireEvent.press(screen.getByText('Reveal model answer', shown)));
    expect(screen.getByText(first.answer, shown)).toBeOnTheScreen();
    expect(screen.getByText('Talking points', shown)).toBeOnTheScreen();
    expect(screen.getByText('Hide model answer', shown)).toBeOnTheScreen();

    // Nothing on this screen can leave except back; Previous is inert on the first card.
    expect(screen.getByLabelText('Previous')).toBeDisabled();
  });

  it('flips a mark under the finger, clears it on a second press, and persists it', async () => {
    await renderPractice();
    await settle(NORMAL_MS);
    const first = seeded().questions[0];
    if (!first) throw new Error('fixture: empty set');
    // The fixture pre-marks the first question confident.
    expect(first.mark).toBe('confident');

    // Pressing the mark that is already set clears it.
    await act(async () =>
      fireEvent.press(screen.getByRole('button', { name: 'Confident', ...shown })),
    );
    expect(await screen.findByText('1 confident', shown)).toBeOnTheScreen();
    expect(screen.getByText('1 needs work', shown)).toBeOnTheScreen();
    await settle(NORMAL_MS);
    expect(seeded().questions[0]?.mark).toBe('unmarked');

    await act(async () =>
      fireEvent.press(screen.getByRole('button', { name: 'Needs work', ...shown })),
    );
    expect(await screen.findByText('2 need work', shown)).toBeOnTheScreen();
    expect(screen.getByText('1 confident', shown)).toBeOnTheScreen();
    await settle(NORMAL_MS);
    // §7.15 acceptance: marks persist — the repo holds it, not the screen.
    expect(seeded().questions[0]?.mark).toBe('needs_work');
  });

  it('pages with Next and Previous and ends on Finish back at the library', async () => {
    await renderPractice();
    await settle(NORMAL_MS);
    const total = seeded().questions.length;

    await act(async () => fireEvent.press(screen.getByLabelText('Next', shown)));
    expect(screen.getByText(`Question 2 of ${total}`, shown)).toBeOnTheScreen();
    expect(screen.getByLabelText('Previous')).toBeEnabled();

    await act(async () => fireEvent.press(screen.getByLabelText('Previous', shown)));
    expect(screen.getByText(`Question 1 of ${total}`, shown)).toBeOnTheScreen();

    for (let step = 1; step < total; step += 1) {
      await act(async () => fireEvent.press(screen.getByLabelText('Next', shown)));
    }
    expect(screen.getByText(`Question ${total} of ${total}`, shown)).toBeOnTheScreen();
    expect(screen.queryByLabelText('Next', shown)).toBeNull();

    await act(async () => fireEvent.press(screen.getByLabelText('Finish', shown)));
    expect(mockNavigate).toHaveBeenCalledWith('/interview');
  });

  it('keeps a card under "Needs work" when it is marked mid-pass, and empties honestly', async () => {
    await renderPractice();
    await settle(NORMAL_MS);

    // The filter chip is named apart from the mark of the same words.
    await act(async () => fireEvent.press(screen.getByLabelText('Needs work questions', shown)));
    expect(screen.getByText('Question 1 of 1', shown)).toBeOnTheScreen();
    const needsWork = seeded().questions.find((question) => question.mark === 'needs_work');
    if (!needsWork) throw new Error('fixture: nothing marked needs_work');
    expect(screen.getByText(needsWork.prompt, shown)).toBeOnTheScreen();

    // The snapshot is taken on the filter choice: marking the card confident does not remove it.
    await act(async () =>
      fireEvent.press(screen.getByRole('button', { name: 'Confident', ...shown })),
    );
    await settle(NORMAL_MS);
    expect(screen.getByText(needsWork.prompt, shown)).toBeOnTheScreen();
    expect(seeded().questions.find((q) => q.id === needsWork.id)?.mark).toBe('confident');

    // Re-choosing the filter re-reads the marks, and now nothing is under it.
    await act(async () => fireEvent.press(screen.getByLabelText('All questions', shown)));
    await act(async () => fireEvent.press(screen.getByLabelText('Needs work questions', shown)));
    expect(screen.getByText('Nothing needs work', shown)).toBeOnTheScreen();
    expect(screen.getByLabelText('Finish', shown)).toBeOnTheScreen();

    await act(async () => fireEvent.press(screen.getByText('Show all questions', shown)));
    expect(screen.getByText(/^Question 1 of \d+$/, shown)).toBeOnTheScreen();
  });

  it('sends a deleted set back to the library instead of a broken card', async () => {
    await renderPractice('int_gone');
    // The client retries a query once before it settles on the error.
    await settle(NORMAL_MS * 3);

    expect(screen.getByText('That practice set is gone', shown)).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByText('Back to Interview prep', shown)));
    expect(mockNavigate).toHaveBeenCalledWith('/interview');
  });
});
