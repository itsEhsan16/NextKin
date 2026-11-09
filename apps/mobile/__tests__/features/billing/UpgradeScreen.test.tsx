import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import type { Subscription } from '@/data/models';
import { createQueryClient, qk } from '@/data/queries';
import { resetMockRepos } from '@/data/repos';
import { REASON_LINE, UpgradeScreen, type UpgradeScreenProps } from '@/features/billing';

const mockBack = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), back: mockBack, replace: jest.fn() }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** V2 §7.8 names these as the systems no NextKin screen may claim a result in. */
const THIRD_PARTY_ATS = ['Workday', 'Greenhouse', 'Taleo', 'Lever', 'iCIMS'];

/**
 * Everything below the header enters on `FadeInDown`, and the Reanimated mock leaves those nodes
 * at opacity 0 — which the queries read as hidden. The sticky bar and the sheet are NOT animated,
 * so they are queried normally.
 */
const HIDDEN = { includeHiddenElements: true } as const;

async function renderUpgrade(props: UpgradeScreenProps = {}) {
  const queryClient = createQueryClient();
  clients.push(queryClient);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>
        <UpgradeScreen {...props} />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
  return queryClient;
}

/** Mock repos resolve on (fake) timers: the plan list and the subscription land inside 900ms. */
const settle = (ms: number) => act(() => jest.advanceTimersByTimeAsync(ms));
const NORMAL_MS = 1000;
/** The confirmation toast holds for 3s before the screen pops behind it. */
const TOAST_MS = 3500;

const subscriptionIn = (client: QueryClient): Subscription | undefined =>
  client.getQueryData<Subscription>(qk.user.subscription());

describe('UpgradeScreen (BILLING 01 577:9155)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
    mockBack.mockClear();
  });

  afterEach(async () => {
    // Flush in-flight mock requests BEFORE unmounting, so a late React Query update does not open
    // an act() scope that overlaps the next test's.
    await act(() => jest.runOnlyPendingTimersAsync());
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
    jest.useRealTimers();
  });

  it('offers Pro as one promise, Free against Pro, the offer and one button (§200)', async () => {
    await renderUpgrade();
    expect(screen.getByLabelText('Loading plans', HIDDEN)).toBeOnTheScreen();
    // The bar is pinned while loading too: it owns the bottom inset, so nothing jumps on load.
    expect(screen.getByLabelText('Upgrade to Pro')).toBeDisabled();

    await settle(NORMAL_MS);

    expect(screen.getByRole('header', { name: 'Go Pro' })).toBeOnTheScreen();
    expect(screen.getByText('NEXTKIN PRO', HIDDEN)).toBeOnTheScreen();
    // Yearly is picked first, and its saving is arithmetic off the two fixture prices.
    expect(screen.getByRole('tab', { name: 'Yearly', selected: true })).toBeOnTheScreen();
    // Ink and white copies of the badge cross-fade with the pill (§201).
    expect(screen.getAllByText('−55%', HIDDEN)).toHaveLength(2);
    expect(screen.getByText('Save 55%', HIDDEN)).toBeOnTheScreen();
    expect(screen.getByText('From ₹667 a month, billed yearly', HIDDEN)).toBeOnTheScreen();

    // Free against Pro on the five lines that decide it, each read out whole.
    expect(
      screen.getByLabelText('Tailored resumes, Every month: Free 3, Pro 100', HIDDEN),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Cover letters, Every month: Free 1, Pro unlimited', HIDDEN),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText(
        'DOCX export, Plus the full template library: Free not included, Pro included',
        HIDDEN,
      ),
    ).toBeOnTheScreen();

    expect(screen.getByLabelText('Start Pro', HIDDEN)).toBeOnTheScreen();

    // §7.8: nothing on this page claims a result in a named third-party system.
    const tree = JSON.stringify(screen.toJSON());
    for (const name of THIRD_PARTY_ATS) expect(tree).not.toContain(name);
  });

  it('closes, or stays on Free, without selling anything', async () => {
    await renderUpgrade();
    await settle(NORMAL_MS);
    await act(async () => fireEvent.press(screen.getByLabelText('Continue with Free', HIDDEN)));
    expect(mockBack).toHaveBeenCalledTimes(1);
    await act(async () => fireEvent.press(screen.getByLabelText('Close', HIDDEN)));
    expect(mockBack).toHaveBeenCalledTimes(2);
  });

  it('leads with the limit that was actually hit (§13.5)', async () => {
    await renderUpgrade({ reason: 'docx' });
    await settle(NORMAL_MS);

    expect(screen.getByText(REASON_LINE.docx, HIDDEN)).toBeOnTheScreen();
    // §13.3 — PDF is never paywalled, and the banner says so in the same breath.
    expect(REASON_LINE.docx).toContain('PDF and TXT stay free on every plan.');
  });

  it('opens on no banner at all when nothing sent the reader here', async () => {
    await renderUpgrade();
    await settle(NORMAL_MS);

    for (const line of Object.values(REASON_LINE)) {
      expect(screen.queryByText(line, HIDDEN)).toBeNull();
    }
    // The offer is still there — it just does not open on an invented grievance.
    expect(screen.getByLabelText('Start Pro', HIDDEN)).toBeOnTheScreen();
  });

  it('re-prices the offer when the period changes', async () => {
    await renderUpgrade();
    await settle(NORMAL_MS);

    expect(screen.getByText('From ₹667 a month, billed yearly', HIDDEN)).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByLabelText('Monthly', HIDDEN)));

    expect(screen.getByText('₹1,499 a month, cancel any time', HIDDEN)).toBeOnTheScreen();
    expect(screen.queryByText('Save 55%', HIDDEN)).toBeNull();
  });

  it('asks before it charges, then moves the plan and pops behind the confirmation', async () => {
    const client = await renderUpgrade({ reason: 'generations' });
    await settle(NORMAL_MS);

    await act(async () => fireEvent.press(screen.getByLabelText('Start Pro', HIDDEN)));

    // The press opens the question, and says where the money is actually taken.
    expect(screen.getByText('Continue to checkout?')).toBeOnTheScreen();
    expect(screen.getByText(/Payment is taken on the NextKin website/)).toBeOnTheScreen();
    expect(subscriptionIn(client)?.plan).toBe('free');

    await act(async () => fireEvent.press(screen.getByLabelText('Continue')));
    await settle(NORMAL_MS);
    // The mutation settles the whole user aggregate, so the invalidated queries refetch behind it.
    await settle(NORMAL_MS);

    expect(subscriptionIn(client)?.plan).toBe('pro');
    /*
     * `HIDDEN` from here on for a second reason: the sheet marks its overlay
     * `accessibilityViewIsModal`, so everything behind it is correctly inert to the queries — and
     * the mocked exit animation never fires the callback that unmounts it, so it stays mounted
     * for the rest of this test even though the screen has closed it.
     */
    // The page stops selling the moment there is nothing to sell.
    expect(screen.getAllByText("You're on NextKin Pro", HIDDEN).length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Manage on the web', HIDDEN)).toBeOnTheScreen();
    expect(screen.queryByLabelText('Start Pro', HIDDEN)).toBeNull();

    // The confirmation is read before the screen leaves, not with it.
    expect(mockBack).not.toHaveBeenCalled();
    await settle(TOAST_MS);
    expect(mockBack).toHaveBeenCalled();
  });
});
