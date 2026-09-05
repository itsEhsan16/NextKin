import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { scoreFromKeywords, useMockModeStore } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { mockStore, resetMockRepos } from '@/data/repos';
import { AtsFixScreen } from '@/features/resumes';
import { CreateSheetProvider } from '@/navigation';

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

/**
 * res_zoho's seeded panel has quick wins but no gap — no fixture score has one, because gaps are
 * minted by generation (`scoreFromKeywords`). The screen has to show one, so this is the same
 * builder the generation repo uses, seeded onto the same document: two missing keywords the body
 * genuinely lacks, and one the profile does not back.
 */
const seeded = scoreFromKeywords({
  present: ['product design', 'SaaS'],
  missing: ['enterprise', 'dashboards'],
  unsupported: ['Kubernetes'],
});

/** Mock repos resolve in 300–900ms; one apply also re-reads the detail and the score. */
const settle = (ms = 1000) => act(() => jest.advanceTimersByTimeAsync(ms));

const pressApply = async (index: number) => {
  const button = screen.getAllByLabelText('Apply')[index];
  expect(button).toBeDefined();
  // A bare press does not flush the state update that swaps the button for the tick.
  await act(async () => {
    if (button) fireEvent.press(button);
  });
};

const storedScore = () => mockStore.state.atsScores.res_zoho;

/** One mount per file — see the test-infra note in the plan's Phase 3 status. */
describe('AtsFixScreen (V2 §7.8 — no artboard)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
    mockStore.state.atsScores.res_zoho = seeded;
    mockPush.mockClear();
    mockBack.mockClear();
  });

  afterEach(async () => {
    await act(() => jest.runOnlyPendingTimersAsync());
    await Promise.all(clients.map((client) => client.cancelQueries()));
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
    jest.useRealTimers();
  });

  it('lists the quick wins, applies one in place, and never offers a gap', async () => {
    const queryClient = createQueryClient();
    clients.push(queryClient);
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <QueryClientProvider client={queryClient}>
          <CreateSheetProvider>
            <AtsFixScreen id="res_zoho" />
          </CreateSheetProvider>
        </QueryClientProvider>
      </SafeAreaProvider>,
    );

    // — Loading: card-shaped blocks under a pinned bar that already owns the bottom inset —
    expect(screen.getByLabelText('Loading fixes')).toBeOnTheScreen();
    expect(screen.getByLabelText('Apply all')).toBeDisabled();

    // Two rounds, not one: the score query is gated on the metadata saying the document HAS a
    // score, so it cannot start until the detail has landed.
    await settle();
    await settle();

    // — The page, and the one honest line about what Apply does (V2 §7.8) —
    expect(screen.getByRole('header', { name: 'Fix with AI' })).toBeOnTheScreen();
    expect(
      screen.getByText(
        "Each fix edits your document and re-scores it. Nothing is added that your profile doesn't back.",
      ),
    ).toBeOnTheScreen();

    // — One card per quick win, each with its suggestion and the section the edit lands in —
    expect(screen.getByText('Missing: "enterprise"')).toBeOnTheScreen();
    expect(screen.getByText('Add "enterprise" to your skills')).toBeOnTheScreen();
    expect(screen.getByText('Missing: "dashboards"')).toBeOnTheScreen();
    expect(screen.getByText('Add "dashboards" to your skills')).toBeOnTheScreen();
    expect(screen.getAllByText('Skills')).toHaveLength(2);

    // — The gap is listed, explained, and has no Apply: §7.8 forbids inserting it —
    expect(screen.getByText('"Kubernetes" is not in your profile')).toBeOnTheScreen();
    expect(screen.getByText("Not on your profile — only add it if it's true")).toBeOnTheScreen();
    expect(screen.getAllByLabelText('Apply')).toHaveLength(2);
    expect(screen.getByLabelText('Apply all 2')).toBeOnTheScreen();

    // — Applying the first one ticks that card where it stands rather than removing it —
    await pressApply(0);
    await settle();
    await settle();

    expect(screen.getByText('Missing: "enterprise"')).toBeOnTheScreen();
    // The tick enters on FadeIn, which the Reanimated mock leaves at opacity 0.
    expect(screen.getByText('Applied', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getAllByLabelText('Apply')).toHaveLength(1);
    expect(screen.getByLabelText('Apply all 1')).toBeOnTheScreen();

    // The document really moved: the check passes and the score is higher than it was seeded.
    const after = storedScore();
    const enterprise = after?.sections
      .flatMap((section) => section.items)
      .find((item) => item.id === 'kw_miss_0');
    expect(enterprise?.passed).toBe(true);
    expect(after?.total).toBeGreaterThan(seeded.total);

    // The gap survived the re-score untouched, still without an action.
    expect(screen.getByText('"Kubernetes" is not in your profile')).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText('Back'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  }, 60000);
});
