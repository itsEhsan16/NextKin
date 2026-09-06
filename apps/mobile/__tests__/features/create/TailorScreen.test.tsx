import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { subscriptionFixture, useMockModeStore } from '@/data/mock';
import type { Subscription } from '@/data/models';
import { createQueryClient, qk } from '@/data/queries';
import { resetMockRepos } from '@/data/repos';
import { TailorScreen } from '@/features/create';

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

/** Free plan with the month's three generations already spent (V2 §13.5's paywall state). */
const spentSubscription: Subscription = {
  ...subscriptionFixture,
  usage: { ...subscriptionFixture.usage, generationsUsed: 3, generationsLimit: 3 },
};

/** A plan that grants no generations at all: 0 of 0 is spent, and the banner has nothing to meter. */
const ungeneratedSubscription: Subscription = {
  ...subscriptionFixture,
  usage: { ...subscriptionFixture.usage, generationsUsed: 0, generationsLimit: 0 },
};

async function renderTailor(seed?: (client: QueryClient) => void) {
  const queryClient = createQueryClient();
  clients.push(queryClient);
  seed?.(queryClient);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>
        <TailorScreen />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

/** Mock repos resolve on (fake) timers: lists ≤ 900ms, JD extraction 1200–2200ms. */
const settle = (ms: number) => act(() => jest.advanceTimersByTimeAsync(ms));
const NORMAL_MS = 1000;
const EXTRACT_MS = 2500;

describe('TailorScreen (V2 §7.5 — no artboard)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
    mockPush.mockClear();
    mockBack.mockClear();
  });

  afterEach(async () => {
    // Flush in-flight mock requests BEFORE unmounting, so a late React Query update does not
    // open an act() scope that overlaps the next test's.
    await act(() => jest.runOnlyPendingTimersAsync());
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
    jest.useRealTimers();
  });

  it('preselects the base resume and shows the quota before any work starts', async () => {
    await renderTailor();
    expect(screen.getByLabelText('Loading tailor setup')).toBeOnTheScreen();
    // The bar is pinned while loading too — it owns the bottom safe-area inset, so the viewport
    // must not change size when the queries land.
    expect(screen.getByLabelText('Review job description')).toBeDisabled();

    await settle(NORMAL_MS);

    expect(screen.getByRole('header', { name: 'Tailor a resume' })).toBeOnTheScreen();
    // res_base is the only document flagged `isBase`, and nothing was passed in resumeId.
    expect(screen.getByText('Product Designer')).toBeOnTheScreen();
    expect(screen.getByText('Base resume · 3 pages · PDF and DOCX ready')).toBeOnTheScreen();
    expect(screen.getByLabelText('Base resume, Product Designer')).toBeOnTheScreen();

    // V2 §13.5: the cap is on screen before the work begins, not after it is refused — and it is
    // said ONCE. The banner owns that line; repeating it on the action bar would draw it twice on
    // one page and announce it twice to a screen reader.
    expect(screen.getAllByText('1 of 3 generations left this month')).toHaveLength(1);

    expect(screen.getByText('Paste the description')).toBeOnTheScreen();
    expect(screen.getByText('PDF, DOCX or TXT')).toBeOnTheScreen();
    expect(screen.getByText('From a job you saved')).toBeOnTheScreen();

    // Nothing to read yet, so the CTA is inert rather than absent.
    expect(screen.getByLabelText('Review job description')).toBeDisabled();
  });

  it('extracts a pasted description and pushes to the review screen', async () => {
    await renderTailor();
    await settle(NORMAL_MS);

    await act(async () => fireEvent.press(screen.getByLabelText('Paste the description')));
    await act(async () =>
      fireEvent.changeText(
        screen.getByLabelText('Job description'),
        'Senior Product Designer, Bengaluru. Own design systems and run A/B tests with the growth team.',
      ),
    );

    await act(async () => fireEvent.press(screen.getByLabelText('Review job description')));
    await settle(EXTRACT_MS);

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/create/jd-review',
      // The base resume rides along: the review screen starts generation and must not guess.
      params: { draftId: expect.any(String), baseResumeId: 'res_base' },
    });
  });

  it('replaces the CTA with the upgrade route once the quota is spent', async () => {
    await renderTailor((client) => client.setQueryData(qk.user.subscription(), spentSubscription));
    await settle(NORMAL_MS);

    expect(screen.getByText('0 of 3 generations left this month')).toBeOnTheScreen();
    expect(
      screen.getByText("This month's 3 generations are used. Pro raises the monthly cap."),
    ).toBeOnTheScreen();
    // §13.5: the upsell replaces the action rather than interrupting the page with an alert.
    expect(screen.queryByLabelText('Review job description')).toBeNull();

    await act(async () => fireEvent.press(screen.getByLabelText('See Pro plans')));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/upgrade',
      params: { reason: 'generations' },
    });
  });

  it('treats a plan with no generations as spent rather than as unlimited', async () => {
    await renderTailor((client) =>
      client.setQueryData(qk.user.subscription(), ungeneratedSubscription),
    );
    await settle(NORMAL_MS);

    // Nothing to meter, so the banner draws nothing — the bar carries the whole story.
    expect(screen.queryByText(/left this month/)).toBeNull();
    expect(
      screen.getByText('Your plan has no generations this month. Pro raises the monthly cap.'),
    ).toBeOnTheScreen();
    expect(screen.queryByLabelText('Review job description')).toBeNull();
    expect(screen.getByLabelText('See Pro plans')).toBeOnTheScreen();
  });
});
