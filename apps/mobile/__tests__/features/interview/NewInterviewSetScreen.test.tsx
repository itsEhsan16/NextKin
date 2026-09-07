import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { mockStore, resetMockRepos } from '@/data/repos';
import { NewInterviewSetScreen } from '@/features/interview';

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

/** Sheets and segments animate; the Reanimated mock leaves entering nodes at opacity 0. */
const shown = { includeHiddenElements: true } as const;

/** Mock repos resolve on (fake) timers: "normal" is ≤ 900ms per request. */
const settle = (ms: number) => act(() => jest.advanceTimersByTimeAsync(ms));
const NORMAL_MS = 1000;

const COST_NOTE = 'Writes a fresh set of questions. Earlier sets are kept.';

async function renderSetup(resumeId?: string) {
  const queryClient = createQueryClient();
  clients.push(queryClient);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>
        <NewInterviewSetScreen resumeId={resumeId} />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

describe('NewInterviewSetScreen (V2 §7.15 / §13.5 — no artboard)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
    mockPush.mockClear();
    mockReplace.mockClear();
  });

  afterEach(async () => {
    await act(() => jest.runOnlyPendingTimersAsync());
    await cleanup();
    // A started run leaves a progress interval behind; the mock repo's own note asks for this.
    jest.clearAllTimers();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
    jest.useRealTimers();
  });

  it('defaults to the base resume, says what the press costs, and starts the run', async () => {
    await renderSetup();
    // The bar is pinned while loading too, with the cost said before anything is chosen.
    expect(screen.getByLabelText('Write questions')).toBeDisabled();
    expect(screen.getByText(COST_NOTE, shown)).toBeOnTheScreen();

    await settle(NORMAL_MS);

    expect(screen.getByRole('header', { name: 'New question set' })).toBeOnTheScreen();
    // res_base is the only document flagged `isBase`; it has no job linked.
    expect(screen.getByLabelText('Resume, Product Designer', shown)).toBeOnTheScreen();
    expect(screen.getByText(/No job description linked/, shown)).toBeOnTheScreen();

    const before = mockStore.state.generations.length;
    await act(async () => fireEvent.press(screen.getByLabelText('Write questions', shown)));
    await settle(NORMAL_MS);

    expect(mockStore.state.generations).toHaveLength(before + 1);
    const run = mockStore.state.generations[0];
    expect(run?.kind).toBe('interview');
    expect(run?.resumeId).toBe('res_base');
    // Replace, not push: the form must not stay behind a run that is already spending quota.
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/generations/[id]',
      params: { id: run?.id },
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('lets the reader pick another resume from the library sheet', async () => {
    await renderSetup();
    await settle(NORMAL_MS);

    await act(async () =>
      fireEvent.press(screen.getByLabelText('Resume, Product Designer', shown)),
    );
    expect(screen.getByText('Choose a resume', shown)).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByText('UX Designer Resume', shown)));
    await settle(NORMAL_MS);

    expect(screen.getByLabelText('Resume, UX Designer Resume', shown)).toBeOnTheScreen();
    // That one is tailored to a job, and the caption says so.
    expect(screen.getByText(/Tailored to the linked job description/, shown)).toBeOnTheScreen();
    // A cover letter is never offered as a source.
    expect(screen.queryByText('Stripe cover letter', shown)).toBeNull();
  });

  it('replaces the run with the upgrade route for a resume whose set already exists', async () => {
    // The seeded set belongs to res_2, and Free includes one set per resume (§13.3).
    await renderSetup('res_2');
    await settle(NORMAL_MS);

    expect(screen.getByLabelText('Resume, Stripe — Senior PD', shown)).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Free includes one question set per resume. Pro regenerates as often as you like.',
        shown,
      ),
    ).toBeOnTheScreen();
    // §13.5: the upsell replaces the action rather than interrupting the page with an alert.
    expect(screen.queryByLabelText('Write questions', shown)).toBeNull();
    // C1 in toreview.md: no reset date is known for a per-resume cap, so none is claimed.
    expect(screen.queryByText(/resets/i, shown)).toBeNull();

    await act(async () => fireEvent.press(screen.getByLabelText('See Pro plans', shown)));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/upgrade',
      params: { reason: 'interview' },
    });
    expect(mockStore.state.generations[0]?.kind).not.toBe('interview');
  });

  it('writes a generic set from a role title, and refuses an empty one', async () => {
    await renderSetup();
    await settle(NORMAL_MS);

    await act(async () => fireEvent.press(screen.getByText('By role title', shown)));
    // §7.15: the standalone set is labelled generic before it exists, not only afterwards.
    expect(
      screen.getByText('Generic — not tailored to a job description', shown),
    ).toBeOnTheScreen();
    expect(screen.queryByLabelText('Resume, Product Designer', shown)).toBeNull();

    const before = mockStore.state.generations.length;
    await act(async () => fireEvent.press(screen.getByLabelText('Write questions', shown)));
    expect(screen.getByText('Add the role title the questions are for.', shown)).toBeOnTheScreen();
    expect(mockStore.state.generations).toHaveLength(before);

    await act(async () =>
      fireEvent.changeText(screen.getByLabelText('Role title', shown), 'Data Engineer'),
    );
    expect(screen.queryByText('Add the role title the questions are for.', shown)).toBeNull();
    await act(async () => fireEvent.press(screen.getByLabelText('Write questions', shown)));
    await settle(NORMAL_MS);

    const run = mockStore.state.generations[0];
    expect(run?.kind).toBe('interview');
    expect(run?.resumeId).toBeUndefined();
    expect(run?.title).toBe('Data Engineer');
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/generations/[id]',
      params: { id: run?.id },
    });
  });

  it('pins an empty library to the role-title path instead of a dead end', async () => {
    mockStore.state.resumes = mockStore.state.resumes.filter((item) => item.docType !== 'resume');
    await renderSetup();
    await settle(NORMAL_MS);

    expect(screen.getByText(/No resume in your library yet/, shown)).toBeOnTheScreen();
    expect(screen.queryByText('From a resume', shown)).toBeNull();
    expect(screen.getByLabelText('Role title', shown)).toBeOnTheScreen();
    expect(screen.getByLabelText('Write questions', shown)).toBeOnTheScreen();
  });
});
