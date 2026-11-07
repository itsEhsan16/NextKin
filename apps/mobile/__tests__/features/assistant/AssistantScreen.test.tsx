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

/** Free plan with nothing sent today: the welcome draws no allowance. */
const freshSubscription: Subscription = {
  ...subscriptionFixture,
  usage: { ...subscriptionFixture.usage, assistantMessagesUsed: 0, assistantMessagesLimit: 20 },
};

/** Free plan with today's messages spent (V2 §13.5's paywall state). */
const spentSubscription: Subscription = {
  ...subscriptionFixture,
  usage: { ...subscriptionFixture.usage, assistantMessagesUsed: 20, assistantMessagesLimit: 20 },
};

const lastMessage = () => mockStore.state.assistant.messages.at(-1);

/** The resume the screen uses unless told otherwise: the latest finished one. */
const usable = () =>
  mockStore.state.resumes
    .filter((item) => item.docType === 'resume' && item.status === 'ready' && !item.archived)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
const latestResume = () => usable()[0]!;

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

describe('AssistantScreen (V2 §7.16, redesigned §188)', () => {
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

  it('shows the thread, the allowance, the label, the resume in use, and nothing that acts', async () => {
    await renderAssistant();
    // The composer is pinned while loading too, inert.
    expect(screen.getByLabelText('Message')).toBeOnTheScreen();
    expect(screen.getByLabelText('Sending')).toBeDisabled();

    await settle(NORMAL_MS);

    expect(screen.getByRole('header', { name: 'AI Assistant' })).toBeOnTheScreen();
    // §13.5: the daily cap is on screen before it is hit, said as a daily one.
    expect(screen.getByText('8 of 20 left today', shown)).toBeOnTheScreen();
    expect(screen.queryByText(/this month/, shown)).toBeNull();
    expect(screen.getByText(ASSISTANT_DISCLAIMER, shown)).toBeOnTheScreen();
    // Answers use your latest resume unless you say otherwise, and the chip says which.
    expect(screen.getByText(`Using ${latestResume().title}`, shown)).toBeOnTheScreen();

    // The seeded thread: one answer, one refusal; the refusal restates the scope.
    expect(screen.getByText(/two-year gap/, shown)).toBeOnTheScreen();
    expect(screen.getByText(REFUSAL_LINE, shown)).toBeOnTheScreen();
    expect(screen.getAllByText(/^out of scope$/i, shown)).toHaveLength(1);

    // §7.16: read-and-advise only. Questions aside, no control may change anything but the chat.
    const buttons = screen
      .getAllByRole('button', shown)
      .map((node) => String(node.props.accessibilityLabel ?? ''))
      .filter((label) => !label.startsWith('Ask: '));
    expect(
      buttons.filter((label) => /apply|fix|save|delete|edit|regenerate|tailor/i.test(label)),
    ).toEqual([]);
  });

  it('streams an answer, draws its bold as bold, names the resume, and offers follow-ups', async () => {
    await renderAssistant();
    await settle(NORMAL_MS);

    const before = mockStore.state.assistant.messages.length;
    await send('Why is my ATS score what it is?');

    expect(mockStore.state.assistant.messages).toHaveLength(before + 2);
    // While it is written the composer waits.
    expect(screen.getByLabelText('Sending', shown)).toBeDisabled();

    await settle(STREAM_MS);
    await settle(NORMAL_MS);

    const reply = lastMessage();
    expect(reply?.status).toBe('complete');
    expect(reply?.contextResumeId).toBe(latestResume().id);
    expect(reply?.text).toContain('**');
    expect(screen.queryByText(/Writing…/, shown)).toBeNull();
    // The answer marks names and numbers in **bold**; none of the asterisks reach the screen.
    expect(screen.queryByText(/\*\*/, shown)).toBeNull();
    expect(screen.getAllByText(latestResume().title, shown).length).toBeGreaterThan(0);
    expect(screen.getByText(`Used ${latestResume().title}`, shown)).toBeOnTheScreen();
    expect(screen.getAllByLabelText('Copy answer', shown).length).toBeGreaterThan(0);
    // The meter moves without a reload.
    expect(screen.getByText('7 of 20 left today', shown)).toBeOnTheScreen();
    // The next questions on the same topic, one tap each.
    expect(screen.getAllByLabelText(/^Ask: /, shown).length).toBeGreaterThan(0);
  });

  it('asks a follow-up with one tap', async () => {
    await renderAssistant();
    await settle(NORMAL_MS);
    await send('How do I explain a career gap?');
    await settle(STREAM_MS);
    await settle(NORMAL_MS);

    const chip = screen.getAllByLabelText(/^Ask: /, shown)[0]!;
    const prompt = String(chip.props.accessibilityLabel).replace(/^Ask: /, '');
    const before = mockStore.state.assistant.messages.length;
    await act(async () => fireEvent.press(chip));
    await settle(NORMAL_MS);
    expect(mockStore.state.assistant.messages).toHaveLength(before + 2);
    expect(mockStore.state.assistant.messages[before]?.text).toBe(prompt);
  });

  it('refuses an off-topic question whole, in the assistant’s own voice', async () => {
    await renderAssistant();
    await settle(NORMAL_MS);

    await send("What's the weather like in Chennai today?");
    await settle(NORMAL_MS);

    const reply = lastMessage();
    expect(reply?.refusal).toBe('off_topic');
    expect(reply?.status).toBe('complete');
    expect(screen.getAllByText(REFUSAL_LINE, shown)).toHaveLength(2);
    expect(screen.getAllByText(/^out of scope$/i, shown)).toHaveLength(2);
    expect(screen.queryByText('Try again', shown)).toBeNull();
    // No follow-ups under a refusal.
    expect(screen.queryAllByLabelText(/^Ask: /, shown)).toHaveLength(0);
  });

  it('greets an empty chat by name with questions from what you have, asked in one tap', async () => {
    mockStore.state.assistant.messages = [];
    await renderAssistant(undefined, (client) =>
      client.setQueryData(qk.user.subscription(), freshSubscription),
    );
    await settle(NORMAL_MS);
    await settle(NORMAL_MS);

    expect(screen.getByRole('header', { name: /how can I help\?$/ })).toBeOnTheScreen();
    // The first question is about this resume's real score.
    const scorePrompt = screen.getByLabelText(/^Ask: Why does my resume score \d+\?$/, shown);
    // A fresh allowance has nothing to warn about yet; the label is always there.
    expect(screen.queryByText(/left today/, shown)).toBeNull();
    expect(screen.getByText(ASSISTANT_DISCLAIMER, shown)).toBeOnTheScreen();

    await act(async () => fireEvent.press(scorePrompt));
    await settle(NORMAL_MS);
    expect(mockStore.state.assistant.messages).toHaveLength(2);
    expect(mockStore.state.assistant.messages[0]?.text).toMatch(/^Why does my resume score \d+\?$/);
  });

  it('switches the resume from the chip, and can answer with none', async () => {
    await renderAssistant();
    await settle(NORMAL_MS);

    const other = usable()[1]!;
    await act(async () =>
      fireEvent.press(screen.getByLabelText(`Using ${latestResume().title}`, shown)),
    );
    await act(async () => fireEvent.press(screen.getByLabelText(other.title, shown)));
    expect(screen.getByText(`Using ${other.title}`, shown)).toBeOnTheScreen();

    await send('Why is my ATS score what it is?');
    await settle(STREAM_MS);
    expect(lastMessage()?.contextResumeId).toBe(other.id);
    await settle(NORMAL_MS);

    await act(async () => fireEvent.press(screen.getByLabelText('Stop using this resume', shown)));
    expect(screen.queryByText(/^Using /, shown)).toBeNull();
    await send('How do I explain a career gap?');
    await settle(STREAM_MS);
    expect(lastMessage()?.contextResumeId).toBeUndefined();
  });

  it('opens about a document and answers with it', async () => {
    await renderAssistant('res_base');
    await settle(NORMAL_MS);

    expect(screen.getByText('Using Product Designer', shown)).toBeOnTheScreen();
    await send('Why is my ATS score what it is?');
    await settle(STREAM_MS);
    expect(lastMessage()?.contextResumeId).toBe('res_base');
  });

  it('starts a new chat and keeps the old one in Chats', async () => {
    await renderAssistant();
    await settle(NORMAL_MS);
    const earlier = mockStore.state.assistantHistory.length;

    await act(async () => fireEvent.press(screen.getByLabelText('New chat', shown)));
    await settle(NORMAL_MS);
    expect(mockStore.state.assistant.messages).toHaveLength(0);
    expect(screen.getByRole('header', { name: /how can I help\?$/ })).toBeOnTheScreen();
    expect(mockStore.state.assistantHistory.length).toBe(earlier + 1);

    await act(async () => fireEvent.press(screen.getByLabelText('Chats', shown)));
    await settle(NORMAL_MS);
    expect(screen.getByText('Pick up where you left off.', shown)).toBeOnTheScreen();
  });

  it('replaces the composer with the upsell at zero, and keeps the label', async () => {
    await renderAssistant(undefined, (client) =>
      client.setQueryData(qk.user.subscription(), spentSubscription),
    );
    await settle(NORMAL_MS);

    expect(
      screen.getByText('0 of 20 left today. Pro gives you many more each day.', shown),
    ).toBeOnTheScreen();
    expect(screen.queryByLabelText('Message', shown)).toBeNull();
    expect(screen.queryByLabelText('Send', shown)).toBeNull();
    expect(screen.getByText(ASSISTANT_DISCLAIMER, shown)).toBeOnTheScreen();
    // No reset time is known for the daily cap, so none is claimed.
    expect(screen.queryByText(/resets|tomorrow|midnight/i, shown)).toBeNull();

    await act(async () => fireEvent.press(screen.getByLabelText('See Pro plans', shown)));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/upgrade',
      params: { reason: 'assistant' },
    });
  });

  it('shows an answer that stopped part-way and re-asks the question on retry', async () => {
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

    expect(mockStore.state.assistant.messages).toHaveLength(before + 2);
    expect(lastMessage()?.status).toBe('complete');
  });
});
