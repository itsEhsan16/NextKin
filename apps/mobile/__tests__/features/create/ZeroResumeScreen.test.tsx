import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { subscriptionFixture, useMockModeStore } from '@/data/mock';
import type { Subscription } from '@/data/models';
import { createQueryClient, qk } from '@/data/queries';
import { mockStore, resetMockRepos } from '@/data/repos';
import { ZeroResumeScreen } from '@/features/create';
import {
  ZERO_RESUME_GUARDRAIL_BODY,
  ZERO_RESUME_GUARDRAIL_TITLE,
} from '@/features/create/zeroResume';

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    navigate: jest.fn(),
    back: mockBack,
    replace: mockReplace,
  }),
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

/** Cards enter on `FadeInDown`; the Reanimated mock leaves an entering node at opacity 0. */
const shown = { includeHiddenElements: true } as const;

/** Mock repos resolve on (fake) timers: lists ≤ 900ms, JD extraction 1200–2200ms. */
const settle = (ms: number) => act(() => jest.advanceTimersByTimeAsync(ms));
const NORMAL_MS = 1000;

/**
 * One press runs two mutations back to back, and the second is not scheduled until the first has
 * resolved — so the clock moves in one-second steps rather than one jump past both.
 */
async function settleChain() {
  for (let step = 0; step < 5; step += 1) await settle(1000);
}

const JD_TEXT =
  'Senior Product Designer, Bengaluru. Own the design system and run A/B tests with growth.';

async function renderZeroResume(seed?: (client: QueryClient) => void) {
  const queryClient = createQueryClient();
  clients.push(queryClient);
  seed?.(queryClient);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>
        <ZeroResumeScreen />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

/** Chooses "Paste the description" and types one in. */
async function pasteJd(text = JD_TEXT) {
  await act(async () => fireEvent.press(screen.getByLabelText('Paste the description')));
  await act(async () => fireEvent.changeText(screen.getByLabelText('Job description'), text));
}

describe('ZeroResumeScreen (V2 §7.9 — no artboard)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
    mockPush.mockClear();
    mockBack.mockClear();
    mockReplace.mockClear();
  });

  afterEach(async () => {
    // Flush in-flight mock requests BEFORE unmounting, so a late React Query update does not
    // open an act() scope that overlaps the next test's.
    await act(() => jest.runOnlyPendingTimersAsync());
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('prefills the name, meters the quota and states the guardrail before anything is pressed', async () => {
    await renderZeroResume();
    expect(screen.getByLabelText('Loading first draft setup')).toBeOnTheScreen();
    // The bar is pinned while loading too — it owns the bottom safe-area inset, so the viewport
    // must not change size when the queries land.
    expect(screen.getByLabelText('Draft my resume')).toBeDisabled();

    await settle(NORMAL_MS);

    expect(screen.getByRole('header', { name: 'Start from nothing' })).toBeOnTheScreen();
    // The fixture user is George Smith; the field stays editable, it is just filled in.
    expect(screen.getByLabelText('Full name', shown).props.value).toBe('George Smith');

    // §13.5: the cap is on screen before the work begins, not after it is refused.
    expect(screen.getByText('1 of 3 generations left this month', shown)).toBeOnTheScreen();

    // §7.9's integrity note, on the page before a single field is typed.
    expect(screen.getByText(ZERO_RESUME_GUARDRAIL_TITLE, shown)).toBeOnTheScreen();
    expect(screen.getByText(ZERO_RESUME_GUARDRAIL_BODY, shown)).toBeOnTheScreen();

    // Both of §7.9's required inputs are marked, and marked the same way: the name that prints at
    // the top of the draft, and the JD the draft is written against. The name's marker also
    // reserves its helper row, so a validation error swaps the line instead of pushing the rest of
    // the form down — which is the height `ZeroResumeSkeleton` draws.
    expect(screen.getAllByText('Required.', shown)).toHaveLength(2);
  });

  it('refuses the press with a visible reason until the required fields are filled', async () => {
    await renderZeroResume();
    await settle(NORMAL_MS);

    // Clear the prefilled name: name and years are §7.9's two required fields.
    await act(async () => fireEvent.changeText(screen.getByLabelText('Full name', shown), ''));
    await act(async () => fireEvent.press(screen.getByLabelText('Draft my resume')));

    expect(screen.getByText('Fill in the highlighted fields to start.')).toBeOnTheScreen();
    expect(
      screen.getByText('Add the name you want printed on the resume.', shown),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Tell us how many years you have worked. Type 0 if you are starting out.',
        shown,
      ),
    ).toBeOnTheScreen();
    expect(mockReplace).not.toHaveBeenCalled();

    // Zero is a real answer here — filling both fields clears the refusal, and what is left to say
    // is that the job description is still missing.
    await act(async () =>
      fireEvent.changeText(screen.getByLabelText('Full name', shown), 'Asha Rao'),
    );
    await act(async () =>
      fireEvent.changeText(screen.getByLabelText('Years of experience', shown), '0'),
    );
    await act(async () => fireEvent.press(screen.getByLabelText('Draft my resume')));

    expect(
      screen.getByText('Add the job description you want the draft written against.'),
    ).toBeOnTheScreen();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('extracts the description, starts a zero_resume run and lands on the progress screen', async () => {
    await renderZeroResume();
    await settle(NORMAL_MS);

    await act(async () =>
      fireEvent.changeText(screen.getByLabelText('Years of experience', shown), '4'),
    );
    await act(async () =>
      fireEvent.changeText(screen.getByLabelText('Target job title', shown), 'Product Designer'),
    );
    await pasteJd();

    await act(async () => fireEvent.press(screen.getByLabelText('Draft my resume')));
    // Two mutations behind one press: the extraction, then the run it is generated against.
    await settleChain();

    const generation = mockStore.state.generations.find((entry) => entry.kind === 'zero_resume');
    expect(generation).toBeDefined();
    expect(generation?.jdId).toEqual(expect.any(String));
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/generations/[id]',
      params: { id: generation?.id },
    });
  });

  it('replaces the CTA with the upgrade route once the generation quota is spent', async () => {
    await renderZeroResume((client) =>
      client.setQueryData(qk.user.subscription(), spentSubscription),
    );
    await settle(NORMAL_MS);

    expect(
      screen.getByText("This month's 3 generations are used. Pro raises the monthly cap."),
    ).toBeOnTheScreen();
    // §13.5: the upsell replaces the action rather than interrupting the page with an alert.
    expect(screen.queryByLabelText('Draft my resume')).toBeNull();

    await act(async () => fireEvent.press(screen.getByLabelText('See Pro plans')));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/upgrade',
      params: { reason: 'generations' },
    });
  });
});
