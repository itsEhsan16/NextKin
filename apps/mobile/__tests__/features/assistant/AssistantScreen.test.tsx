import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { REFUSAL_LINE, subscriptionFixture, useMockModeStore } from '@/data/mock';
import { ASSISTANT_DISCLAIMER, type Subscription } from '@/data/models';
import { createQueryClient, qk } from '@/data/queries';
import { ASSISTANT_TICK_MS, mockStore, resetMockRepos } from '@/data/repos';
import { AssistantScreen } from '@/features/assistant';

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

/** Chips and cards animate; the Reanimated mock leaves entering nodes at opacity 0. */
const shown = { includeHiddenElements: true } as const;

/** Mock repos resolve on (fake) timers: "normal" is ≤ 900ms per request. */
const settle = (ms: number) => act(() => jest.advanceTimersByTimeAsync(ms));
const NORMAL_MS = 1000;
/** A long answer is ~120 tokens at two a tick; this is more than any canned reply needs. */
const STREAM_MS = ASSISTANT_TICK_MS * 200;

/** Free plan with today's messages spent (V2 §13.5's paywall state). */
const spentSubscription: Subscription = {
  ...subscriptionFixture,
  usage: { ...subscriptionFixture.usage, assistantMessagesUsed: 20, assistantMessagesLimit: 20 },
};

const lastMessage = () => mockStore.state.assistant.messages.at(-1);

async function renderAssistant(resumeId?: string, seed?: (client: QueryClient) => void) {
  const queryClient = createQueryClient();
  clients.push(queryClient);
  seed?.(queryClient);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>
        <AssistantScreen resumeId={resumeId} />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

async function send(text: string) {
  await act(async () => fireEvent.changeText(screen.getByLabelText('Message', shown), text));
  await act(async () => fireEvent.press(screen.getByLabelText('Send', shown)));
  await settle(NORMAL_MS);
}

describe('AssistantScreen (V2 §7.16 — no artboard)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
    mockPush.mockClear();
    mockBack.mockClear();
  });

  afterEach(async () => {
    await act(() => jest.runOnlyPendingTimersAsync());
    await cleanup();
    // A reply left streaming keeps its interval; the repo's own note asks for this.
    jest.clearAllTimers();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
    jest.useRealTimers();
  });

  it('shows the thread, the daily meter, the label, and no control that could act', async () => {
    await renderAssistant();
    // The composer is pinned while loading too, inert.
    expect(screen.getByLabelText('Message')).toBeOnTheScreen();
    expect(screen.getByLabelText('Sending')).toBeDisabled();

    await settle(NORMAL_MS);

    expect(screen.getByRole('header', { name: 'AI assistant' })).toBeOnTheScreen();
    // §13.5: the cap is on screen before it is hit — and it is a DAILY cap, said as one.
    expect(screen.getByText('8 of 20 messages left today', shown)).toBeOnTheScreen();
    expect(screen.queryByText(/this month/, shown)).toBeNull();
    // §7.16: the label is on the composer, so it is visible whatever the transcript shows.
    expect(screen.getByText(ASSISTANT_DISCLAIMER, shown)).toBeOnTheScreen();

    // The seeded thread: one answer, one refusal — the refusal restates the scope.
    expect(screen.getByText(/two-year gap/, shown)).toBeOnTheScreen();
    expect(screen.getByText(REFUSAL_LINE, shown)).toBeOnTheScreen();
    expect(screen.getAllByText('Out of scope', shown)).toHaveLength(1);
    // The suggested prompts are offered whenever the composer is empty.
    expect(screen.getByLabelText('Ask: How do I explain a career gap?', shown)).toBeOnTheScreen();

    // §7.16: read-and-advise only. Nothing on this screen may mutate anything but the thread.
    const buttons = screen
      .getAllByRole('button', shown)
      .map((node) => String(node.props.accessibilityLabel ?? ''));
    expect(
      buttons.filter((label) => /apply|fix|save|delete|edit|regenerate|tailor/i.test(label)),
    ).toEqual([]);
  });

  it('streams an on-topic reply into one bubble and moves the meter', async () => {
    await renderAssistant();
    await settle(NORMAL_MS);

    const before = mockStore.state.assistant.messages.length;
    await send('How do I explain a career gap?');

    expect(mockStore.state.assistant.messages).toHaveLength(before + 2);
    expect(screen.getAllByText('How do I explain a career gap?', shown).length).toBeGreaterThan(0);
    // The reply's shell is on screen for the stream to fill; the composer waits for it.
    expect(screen.getByText(/Thinking…|Writing…/, shown)).toBeOnTheScreen();
    expect(screen.getByLabelText('Sending', shown)).toBeDisabled();

    await settle(STREAM_MS);
    await settle(NORMAL_MS);

    const reply = lastMessage();
    expect(reply?.role).toBe('assistant');
    expect(reply?.status).toBe('complete');
    expect(reply?.refusal).toBeUndefined();
    expect(screen.getByText(reply?.text ?? '§', shown)).toBeOnTheScreen();
    expect(screen.queryByText(/Thinking…|Writing…/, shown)).toBeNull();
    // §13.3: a message costs a message, and the meter says so without a reload.
    expect(screen.getByText('7 of 20 messages left today', shown)).toBeOnTheScreen();
    expect(screen.getByLabelText('Send', shown)).toBeOnTheScreen();
  });

  it('refuses an off-topic question whole, in the assistant’s own voice', async () => {
    await renderAssistant();
    await settle(NORMAL_MS);

    await send("What's the weather like in Chennai today?");
    await settle(NORMAL_MS);

    const reply = lastMessage();
    expect(reply?.refusal).toBe('off_topic');
    // A refusal arrives complete: it never "thinks about" a question it declined.
    expect(reply?.status).toBe('complete');
    expect(screen.getAllByText(REFUSAL_LINE, shown)).toHaveLength(2);
    expect(screen.getAllByText('Out of scope', shown)).toHaveLength(2);
    // Not a red error state: the retry state is for a broken answer, not a declined one.
    expect(screen.queryByText('Try again', shown)).toBeNull();
  });

  it('fills the composer from a suggested prompt rather than sending it', async () => {
    await renderAssistant();
    await settle(NORMAL_MS);

    const before = mockStore.state.assistant.messages.length;
    await act(async () =>
      fireEvent.press(screen.getByLabelText('Ask: Why is my ATS score what it is?', shown)),
    );
    expect(screen.getByLabelText('Message', shown)).toHaveProp(
      'value',
      'Why is my ATS score what it is?',
    );
    expect(mockStore.state.assistant.messages).toHaveLength(before);
    // With a draft in the field the prompts step aside.
    expect(screen.queryByLabelText('Ask: How do I explain a career gap?', shown)).toBeNull();
  });

  it('opens about a document and answers with it as context', async () => {
    await renderAssistant('res_base');
    await settle(NORMAL_MS);

    expect(screen.getByText('About: Product Designer', shown)).toBeOnTheScreen();

    await send('Why is my ATS score what it is?');
    await settle(STREAM_MS);

    const reply = lastMessage();
    expect(reply?.contextResumeId).toBe('res_base');
    expect(reply?.refusal).toBeUndefined();
  });

  it('replaces the composer with the upsell at zero, and keeps the label', async () => {
    await renderAssistant(undefined, (client) =>
      client.setQueryData(qk.user.subscription(), spentSubscription),
    );
    await settle(NORMAL_MS);

    expect(screen.getByText('0 of 20 messages left today', shown)).toBeOnTheScreen();
    // §13.5: the upsell REPLACES the action rather than sitting over it.
    expect(screen.queryByLabelText('Message', shown)).toBeNull();
    expect(screen.queryByLabelText('Send', shown)).toBeNull();
    expect(screen.getByText(ASSISTANT_DISCLAIMER, shown)).toBeOnTheScreen();
    // C1 in toreview.md: no reset time is known for the daily cap, so none is claimed.
    expect(screen.queryByText(/resets|tomorrow|midnight/i, shown)).toBeNull();

    await act(async () => fireEvent.press(screen.getByLabelText('See Pro plans', shown)));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/upgrade',
      params: { reason: 'assistant' },
    });
  });

  it('shows a reply that stopped part-way and re-asks the question on retry', async () => {
    await renderAssistant();
    await settle(NORMAL_MS);

    await send('How do I explain a career gap?');
    await settle(ASSISTANT_TICK_MS * 3);
    useMockModeStore.setState({ mode: 'error' });
    await settle(ASSISTANT_TICK_MS * 2);
    useMockModeStore.setState({ mode: 'normal' });

    expect(lastMessage()?.status).toBe('failed');
    expect(screen.getByText('That answer stopped part-way.', shown)).toBeOnTheScreen();

    const before = mockStore.state.assistant.messages.length;
    await act(async () => fireEvent.press(screen.getByLabelText('Try again', shown)));
    await settle(NORMAL_MS);
    await settle(STREAM_MS);

    // The retry is a fresh turn — the same question, asked again — not an edit of the old one.
    expect(mockStore.state.assistant.messages).toHaveLength(before + 2);
    expect(lastMessage()?.status).toBe('complete');
  });
});
