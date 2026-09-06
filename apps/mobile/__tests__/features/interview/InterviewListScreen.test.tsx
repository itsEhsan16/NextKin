import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import { INTERVIEW_DISCLAIMER } from '@/data/models';
import { createQueryClient } from '@/data/queries';
import { mockStore, resetMockRepos } from '@/data/repos';
import { InterviewListScreen, useInterviewStore } from '@/features/interview';

const mockPush = jest.fn();
const mockBack = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, navigate: jest.fn(), back: mockBack, replace: jest.fn() }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** Cards enter on `FadeInDown`; the Reanimated mock leaves an entering node at opacity 0. */
const shown = { includeHiddenElements: true } as const;

/** Mock repos resolve on (fake) timers: "normal" is ≤ 900ms per request. */
const settle = (ms: number) => act(() => jest.advanceTimersByTimeAsync(ms));
const NORMAL_MS = 1000;

async function renderList() {
  const queryClient = createQueryClient();
  clients.push(queryClient);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>
        <InterviewListScreen />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

describe('InterviewListScreen (V2 §7.15 — no artboard)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
    useInterviewStore.setState({ deleteTarget: null, deleteOpen: false });
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

  it('lists the seeded set with its marks, and the disclaimer under it', async () => {
    await renderList();
    // The bar is pinned while loading too — it owns the bottom safe-area inset.
    expect(screen.getByLabelText('New question set')).toBeDisabled();

    await settle(NORMAL_MS);

    const seeded = mockStore.state.interviewSets[0];
    if (!seeded) throw new Error('fixture: no seeded set');
    expect(screen.getByRole('header', { name: 'Interview prep' })).toBeOnTheScreen();
    expect(screen.getByText(seeded.title, shown)).toBeOnTheScreen();
    // The fixture pre-marks three questions: two confident, one needing work.
    expect(screen.getByText(/^2 confident · 1 needs work · \d+ to go$/, shown)).toBeOnTheScreen();
    // §7.15: the set is tailored, so it must NOT carry the generic label.
    expect(screen.queryByText(/Generic — not tailored/, shown)).toBeNull();
    // §7.15's binding disclaimer, on the library as well as in practice.
    expect(screen.getByText(INTERVIEW_DISCLAIMER, shown)).toBeOnTheScreen();

    await act(async () =>
      fireEvent.press(screen.getByLabelText(new RegExp(`^${seeded.title}, 2 confident`), shown)),
    );
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/interview/[id]',
      params: { id: seeded.id },
    });

    mockPush.mockClear();
    await act(async () => fireEvent.press(screen.getByLabelText('New question set', shown)));
    expect(mockPush).toHaveBeenCalledWith('/interview/new');
  });

  it('labels a standalone set generic and captions the older of two sets for one target', async () => {
    const seeded = mockStore.state.interviewSets[0];
    if (!seeded) throw new Error('fixture: no seeded set');
    // A newer set for the same resume, and a standalone one: both shapes §7.15 distinguishes.
    mockStore.state.interviewSets.unshift(
      { ...seeded, id: 'int_newer', createdAt: new Date().toISOString() },
      {
        ...seeded,
        id: 'int_generic',
        source: 'standalone',
        resumeId: undefined,
        jdId: undefined,
        jobId: undefined,
        roleTitle: 'Data Engineer',
        title: 'Data Engineer',
        createdAt: new Date().toISOString(),
      },
    );
    await renderList();
    await settle(NORMAL_MS);

    expect(screen.getAllByText('Generic — not tailored to a job description', shown)).toHaveLength(
      1,
    );
    expect(screen.getByLabelText(/^Data Engineer, generic set/, shown)).toBeOnTheScreen();
    // Only the older Stripe set is "Earlier"; the newer one and the generic one are not.
    expect(screen.getAllByText(/· Earlier set$/, shown)).toHaveLength(1);
  });

  it('deletes a set from a long press, through the confirm, and lands on the empty state', async () => {
    await renderList();
    await settle(NORMAL_MS);
    const seeded = mockStore.state.interviewSets[0];
    if (!seeded) throw new Error('fixture: no seeded set');

    await act(async () =>
      fireEvent(screen.getByLabelText(new RegExp(`^${seeded.title}`), shown), 'longPress'),
    );
    expect(screen.getByText('Delete this practice set?', shown)).toBeOnTheScreen();
    expect(
      screen.getByText(new RegExp(`"${seeded.title}" and the marks`), shown),
    ).toBeOnTheScreen();

    await act(async () => fireEvent.press(screen.getByLabelText('Delete', shown)));
    await settle(NORMAL_MS);

    expect(mockStore.state.interviewSets.find((set) => set.id === seeded.id)).toBeUndefined();
    expect(screen.getByText('No practice sets yet', shown)).toBeOnTheScreen();

    // The empty state's action and the bar's primary are the same destination.
    const ctas = screen.getAllByLabelText('New question set', shown);
    expect(ctas).toHaveLength(2);
    await act(async () => fireEvent.press(ctas[0] as NonNullable<(typeof ctas)[0]>));
    expect(mockPush).toHaveBeenCalledWith('/interview/new');
  });
});
