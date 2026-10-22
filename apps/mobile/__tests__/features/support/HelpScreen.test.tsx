import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { faqFixture, useMockModeStore } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { resetMockRepos } from '@/data/repos';
import { HelpScreen } from '@/features/support';

const mockPush = jest.fn();
const mockBack = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    navigate: jest.fn(),
    back: mockBack,
    replace: jest.fn(),
  }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/**
 * The applicant tracking systems V2 §7.8 forbids us from claiming a result in. Named here rather
 * than inferred so the guard fails if the FAQ copy ever drifts — the answers about the score are
 * exactly where that temptation lives.
 */
const THIRD_PARTY_ATS = ['Workday', 'Greenhouse', 'Taleo', 'Lever', 'iCIMS'];

/** Mock repos resolve on (fake) timers; the search debounce is another 250ms on top. */
const settle = () => act(() => jest.advanceTimersByTimeAsync(1000));

const SCORE_Q = 'What does the ATS score actually measure?';
const START_Q = 'What do I need before NextKin is useful?';
const LINKEDIN_Q = 'Why can I not import from LinkedIn?';
const QUOTA_Q = 'What do I get on the free plan?';
const EXPORT_Q = 'Which formats can I download?';

/** One mount per file — see the test-infra note in the plan's Phase 3 status. */
describe('HelpScreen (SUPPORT 01 577:6129)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
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

  it('searches, filters by topic and routes the stuck reader to a person', async () => {
    const queryClient = createQueryClient();
    clients.push(queryClient);
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <QueryClientProvider client={queryClient}>
          <HelpScreen />
        </QueryClientProvider>
      </SafeAreaProvider>,
    );

    // — Loading is blocks in the shape of the page, never a spinner —
    expect(screen.getByLabelText('Loading help')).toBeOnTheScreen();
    await settle();

    expect(screen.getByRole('header', { name: 'Help & FAQ' })).toBeOnTheScreen();
    // The hero's lede says how much help there is (SUPPORT 01 577:6156).
    expect(screen.getByText(`${faqFixture.length} answers across five topics.`)).toBeOnTheScreen();
    expect(screen.getByText(START_Q)).toBeOnTheScreen();
    // The board opens on the first question; its answer is on screen before anything is pressed.
    const startAnswer = faqFixture.find((item) => item.question === START_Q)?.answer ?? '';
    expect(screen.getByText(startAnswer, { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByText(SCORE_Q)).toBeOnTheScreen();
    expect(screen.getByText(QUOTA_Q)).toBeOnTheScreen();

    // — A row opens onto its answer. The press needs its own act scope, and the body enters on a
    //   FadeIn, which Reanimated's jest mock leaves at opacity 0 — on screen but "hidden".
    const scoreAnswer = faqFixture.find((item) => item.id === 'faq_score')?.answer ?? '';
    expect(screen.queryByText(scoreAnswer, { includeHiddenElements: true })).toBeNull();
    await act(async () => fireEvent.press(screen.getByLabelText(SCORE_Q)));
    expect(screen.getByText(scoreAnswer, { includeHiddenElements: true })).toBeOnTheScreen();

    // — "Still stuck?" with no topic chosen carries nothing through: §7.14's form opens on its
    //   own default rather than on a subject we guessed.
    await act(async () => fireEvent.press(screen.getByLabelText('Message support')));
    expect(mockPush).toHaveBeenCalledWith('/support/contact');

    // — A topic narrows the list. By role: the Billing group's heading carries the same name —
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Billing' })));
    await settle();
    expect(screen.getByText(`2 of ${faqFixture.length} answers`)).toBeOnTheScreen();
    expect(screen.getByText(QUOTA_Q)).toBeOnTheScreen();
    expect(screen.queryByText(LINKEDIN_Q)).toBeNull();

    // — and it is one of the two FAQ topics that map onto a contact subject, so it travels —
    mockPush.mockClear();
    await act(async () => fireEvent.press(screen.getByLabelText('Message support')));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/support/contact',
      params: { topic: 'billing' },
    });

    // — A word that appears only in an answer body still finds it —
    await act(async () => fireEvent.press(screen.getByLabelText('All topics')));
    await act(async () => fireEvent.changeText(screen.getByLabelText('Search help'), 'watermark'));
    await settle();
    expect(screen.getByText(EXPORT_Q)).toBeOnTheScreen();
    expect(screen.queryByText(START_Q)).toBeNull();

    // — Nothing matched is NOT the error state: the query is named, the field stays on screen so
    //   it can be edited, and there is still a way through to a person.
    await act(async () => fireEvent.changeText(screen.getByLabelText('Search help'), 'kombucha'));
    await settle();
    expect(screen.getByText('No answers matched "kombucha"')).toBeOnTheScreen();
    expect(screen.getByLabelText('Search help')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Try again')).toBeNull();
    // The way through to a person is the "Still stuck?" card below, which is on screen in this
    // branch too — so the empty state offering its own second copy of it said it twice.
    expect(screen.getAllByLabelText('Message support')).toHaveLength(1);

    await act(async () => fireEvent.press(screen.getByLabelText('Clear search')));
    await settle();
    expect(screen.getByText(`${faqFixture.length} answers across five topics.`)).toBeOnTheScreen();
    expect(screen.getByText(LINKEDIN_Q)).toBeOnTheScreen();

    // — §7.8: no copy may claim a result in a named third-party ATS. Swept over what is rendered
    //   and over the whole fixture, because a collapsed row's answer is not in the tree.
    const rendered = JSON.stringify(screen.toJSON());
    const copy = faqFixture.map((item) => `${item.question} ${item.answer}`).join('\n');
    for (const vendor of THIRD_PARTY_ATS) {
      expect(rendered).not.toMatch(new RegExp(vendor, 'i'));
      expect(copy).not.toMatch(new RegExp(vendor, 'i'));
    }

    await act(async () => fireEvent.press(screen.getByLabelText('Back')));
    expect(mockBack).toHaveBeenCalledTimes(1);
  }, 60000);
});
