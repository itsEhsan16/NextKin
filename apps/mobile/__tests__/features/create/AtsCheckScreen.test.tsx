import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { GENERATING_RESUME_ID, subscriptionFixture, useMockModeStore } from '@/data/mock';
import type { Subscription } from '@/data/models';
import { createQueryClient, qk } from '@/data/queries';
import { mockStore, resetMockRepos } from '@/data/repos';
import { AtsCheckScreen } from '@/features/create';
import { pickDocument } from '@/lib';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, navigate: jest.fn(), back: mockBack, replace: mockReplace }),
  Link: ({ children }: PropsWithChildren) => children,
}));

// Partial mock: everything else in the barrel (theme helpers, a11y, format) stays real, and only
// the file browser is stubbed — it is the one call that would reach a native module.
jest.mock('@/lib', () => ({
  ...jest.requireActual('@/lib'),
  pickDocument: jest.fn(),
}));

const mockPick = pickDocument as jest.MockedFunction<typeof pickDocument>;

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** Free plan with this month's three ATS checks already spent (V2 §13.5's paywall state). */
const spentSubscription: Subscription = {
  ...subscriptionFixture,
  usage: { ...subscriptionFixture.usage, atsChecksUsed: 3, atsChecksLimit: 3 },
};

/** Cards enter on `FadeInDown`; the Reanimated mock leaves an entering node at opacity 0. */
const shown = { includeHiddenElements: true } as const;

/** Mock repos resolve on (fake) timers: lists ≤ 900ms, a parse 1200–2200ms. */
const settle = (ms: number) => act(() => jest.advanceTimersByTimeAsync(ms));
const NORMAL_MS = 1000;
const IMPORT_MS = 4000;

async function renderCheck(resumeId?: string, seed?: (client: QueryClient) => void) {
  const queryClient = createQueryClient();
  clients.push(queryClient);
  seed?.(queryClient);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>
        <AtsCheckScreen resumeId={resumeId} />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

describe('AtsCheckScreen (V2 §7.8 / §4.1 — no artboard)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
    mockPush.mockClear();
    mockReplace.mockClear();
    mockBack.mockClear();
    mockPick.mockReset();
  });

  afterEach(async () => {
    // Flush in-flight mock requests BEFORE unmounting, so a late React Query update does not
    // open an act() scope that overlaps the next test's.
    await act(() => jest.runOnlyPendingTimersAsync());
    await cleanup();
    // A started run leaves a progress interval behind; the mock repo's own note asks for this.
    jest.clearAllTimers();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
    jest.useRealTimers();
  });

  it('shows the allowance and the honesty note before any work starts', async () => {
    await renderCheck();
    expect(screen.getByLabelText('Loading ATS check setup')).toBeOnTheScreen();
    // The bar is pinned while loading too — it owns the bottom safe-area inset.
    expect(screen.getByLabelText('Run the check')).toBeDisabled();

    await settle(NORMAL_MS);

    expect(screen.getByRole('header', { name: 'ATS check' })).toBeOnTheScreen();
    // §13.5: the cap is on screen before the work, and it is said exactly once.
    expect(screen.getAllByText('2 of 3 checks left this month', shown)).toHaveLength(1);
    // §7.8: the honesty note is on this screen, not buried behind the number.
    expect(screen.getByText(/measures your document against NextKin/, shown)).toBeOnTheScreen();
    expect(screen.getByText(/does not predict how any employer/, shown)).toBeOnTheScreen();
    // The rubric link needs a document to address, and one is chosen by default.
    expect(screen.getByLabelText('How the ATS score works', shown)).toBeOnTheScreen();
  });

  it('opens the score panel of an already-scored document without spending a check', async () => {
    await renderCheck();
    await settle(NORMAL_MS);

    // res_base is the only document flagged `isBase`, and it already carries a score.
    expect(screen.getByText('Product Designer', shown)).toBeOnTheScreen();
    expect(
      screen.getByText("This document already has an ATS score — opening it doesn't use a check.", {
        ...shown,
      }),
    ).toBeOnTheScreen();

    const before = mockStore.state.generations.length;
    await act(async () => fireEvent.press(screen.getByLabelText('See the ATS score', shown)));
    await settle(NORMAL_MS);

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/resumes/[id]/score',
      params: { id: 'res_base' },
    });
    // Nothing was started, so nothing was spent.
    expect(mockStore.state.generations).toHaveLength(before);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('starts an ATS check for a document that has no score yet', async () => {
    await renderCheck(GENERATING_RESUME_ID);
    await settle(NORMAL_MS);

    expect(screen.getByText('Staff Product Designer — Canva', shown)).toBeOnTheScreen();
    expect(screen.getByText("Counts as one of this month's ATS checks", shown)).toBeOnTheScreen();

    const before = mockStore.state.generations.length;
    await act(async () => fireEvent.press(screen.getByLabelText('Run the check', shown)));
    await settle(NORMAL_MS);

    expect(mockStore.state.generations).toHaveLength(before + 1);
    expect(mockStore.state.generations[0]?.kind).toBe('ats_check');
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/generations/[id]',
      params: { id: expect.any(String) },
    });
  });

  it('replaces the run with the upgrade route once the checks are spent', async () => {
    await renderCheck(GENERATING_RESUME_ID, (client) =>
      client.setQueryData(qk.user.subscription(), spentSubscription),
    );
    await settle(NORMAL_MS);

    expect(screen.getByText('0 of 3 checks left this month', shown)).toBeOnTheScreen();
    expect(
      screen.getByText("This month's 3 ATS checks are used. Pro raises the monthly cap.", shown),
    ).toBeOnTheScreen();
    // §13.5: the upsell replaces the action rather than interrupting the page with an alert.
    expect(screen.queryByLabelText('Run the check', shown)).toBeNull();

    await act(async () => fireEvent.press(screen.getByLabelText('See Pro plans', shown)));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/upgrade',
      params: { reason: 'ats_checks' },
    });
  });

  it('still opens an existing score for free with the checks spent', async () => {
    await renderCheck(undefined, (client) =>
      client.setQueryData(qk.user.subscription(), spentSubscription),
    );
    await settle(NORMAL_MS);

    // The gate is on the action that costs a check, not on the screen: res_base is already
    // scored, so its panel stays reachable.
    expect(screen.queryByLabelText('See Pro plans', shown)).toBeNull();

    const before = mockStore.state.generations.length;
    await act(async () => fireEvent.press(screen.getByLabelText('See the ATS score', shown)));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/resumes/[id]/score',
      params: { id: 'res_base' },
    });
    expect(mockStore.state.generations).toHaveLength(before);
  });

  it('reads a file off the device and checks the document the parse created', async () => {
    mockPick.mockResolvedValue({ name: 'priya-cv.pdf', uri: 'file:///priya-cv.pdf' });
    await renderCheck();
    await settle(NORMAL_MS);

    await act(async () =>
      fireEvent.press(screen.getByLabelText('Check a file from your device', shown)),
    );
    await settle(NORMAL_MS);

    expect(screen.getByText('priya-cv.pdf', shown)).toBeOnTheScreen();
    // §7.4: the parse yields a profile draft that this screen neither applies nor mentions.
    expect(screen.queryByText(/profile/i, shown)).toBeNull();

    await act(async () => fireEvent.press(screen.getByLabelText('Run the check', shown)));
    await settle(IMPORT_MS);

    expect(mockStore.state.resumes[0]?.title).toBe('priya-cv');
    expect(mockStore.state.generations[0]?.kind).toBe('ats_check');
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/generations/[id]',
      params: { id: expect.any(String) },
    });
  });

  it('leaves the page intact when no file comes back and says so on the bar', async () => {
    mockPick.mockResolvedValue(null);
    await renderCheck();
    await settle(NORMAL_MS);

    await act(async () =>
      fireEvent.press(screen.getByLabelText('Check a file from your device', shown)),
    );
    await settle(NORMAL_MS);

    expect(
      screen.getByText("We didn't get a file. Pick a PDF, DOCX or TXT and we'll read it.", shown),
    ).toBeOnTheScreen();
    // The library choice is untouched behind the failed pick.
    expect(screen.getByText('Product Designer', shown)).toBeOnTheScreen();
  });
});
