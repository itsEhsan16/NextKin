import { REFUSAL_LINE, useMockModeStore } from '@/data/mock';
import type { AssistantMessage } from '@/data/models';
import { ASSISTANT_TICK_MS, createMockRepos, type Repos } from '@/data/repos';
import { createMockStore, type MockStore } from '@/data/repos/state';

async function flush<T>(promise: Promise<T>): Promise<T> {
  await jest.runOnlyPendingTimersAsync();
  return promise;
}

/** Subscribes and advances the stream until the reply is terminal, collecting every emission. */
async function stream(repos: Repos, messageId: string): Promise<AssistantMessage[]> {
  const seen: AssistantMessage[] = [];
  const unsubscribe = repos.assistant.subscribe(messageId, (message) => seen.push(message));
  for (let tick = 0; tick < 400; tick += 1) {
    const last = seen[seen.length - 1];
    if (last && last.status !== 'streaming') break;
    await jest.advanceTimersByTimeAsync(ASSISTANT_TICK_MS);
  }
  unsubscribe();
  return seen;
}

describe('AssistantRepo (mock) — V2 §7.16', () => {
  let store: MockStore;
  let repos: Repos;

  beforeEach(() => {
    jest.useFakeTimers();
    useMockModeStore.setState({ mode: 'normal' });
    store = createMockStore();
    repos = createMockRepos(store);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    useMockModeStore.setState({ mode: 'normal' });
  });

  it('streams an on-topic reply token by token, and the joined tokens are the whole answer', async () => {
    const used = store.state.subscription.usage.assistantMessagesUsed ?? 0;
    const { user, reply } = await flush(
      repos.assistant.send({ text: 'How do I explain a career gap?' }),
    );
    expect(user.role).toBe('user');
    expect(reply).toMatchObject({ role: 'assistant', status: 'streaming', text: '' });

    const seen = await stream(repos, reply.id);
    expect(seen.length).toBeGreaterThan(3);
    const last = seen[seen.length - 1];
    expect(last?.status).toBe('complete');
    expect(last?.text.length).toBeGreaterThan(50);
    // Each emission extends the last: the text only ever grows.
    for (let index = 1; index < seen.length; index += 1) {
      expect(seen[index]?.text.startsWith(seen[index - 1]?.text ?? '')).toBe(true);
    }
    // The store holds the finished text, and the meter moved by one.
    const stored = store.state.assistant.messages.find((message) => message.id === reply.id);
    expect(stored?.text).toBe(last?.text);
    expect(store.state.subscription.usage.assistantMessagesUsed).toBe(used + 1);
  });

  it('refuses off-topic whole — a refusal does not stream, and still counts as a message', async () => {
    const used = store.state.subscription.usage.assistantMessagesUsed ?? 0;
    const { reply } = await flush(repos.assistant.send({ text: 'Give me a recipe for dal.' }));
    expect(reply).toMatchObject({ status: 'complete', refusal: 'off_topic', text: REFUSAL_LINE });
    expect(await stream(repos, reply.id)).toEqual([]);
    expect(store.state.subscription.usage.assistantMessagesUsed).toBe(used + 1);
  });

  it('answers about the open document when a resume id is passed', async () => {
    const { reply } = await flush(
      repos.assistant.send({ text: 'Why is my ATS score what it is?', resumeId: 'res_2' }),
    );
    const seen = await stream(repos, reply.id);
    expect(seen[seen.length - 1]?.text).toContain('Stripe — Senior PD');
    expect(seen[seen.length - 1]?.text).toContain('88');
    expect(reply.contextResumeId).toBe('res_2');
  });

  it('stops where it got to when the error mode flips mid-reply', async () => {
    const { reply } = await flush(repos.assistant.send({ text: 'How do I tailor my resume?' }));
    const seen: AssistantMessage[] = [];
    const unsubscribe = repos.assistant.subscribe(reply.id, (message) => seen.push(message));
    await jest.advanceTimersByTimeAsync(ASSISTANT_TICK_MS * 3);
    useMockModeStore.setState({ mode: 'error' });
    await jest.advanceTimersByTimeAsync(ASSISTANT_TICK_MS * 2);
    unsubscribe();
    const last = seen[seen.length - 1];
    expect(last?.status).toBe('failed');
    expect(last?.text.length).toBeGreaterThan(0);
  });

  it('only advances while subscribed, and resumes from where it paused', async () => {
    const { reply } = await flush(repos.assistant.send({ text: 'What is the STAR method?' }));
    const first: AssistantMessage[] = [];
    const stop = repos.assistant.subscribe(reply.id, (message) => first.push(message));
    await jest.advanceTimersByTimeAsync(ASSISTANT_TICK_MS * 2);
    stop();
    const paused = first[first.length - 1]?.text ?? '';
    expect(paused.length).toBeGreaterThan(0);
    await jest.advanceTimersByTimeAsync(ASSISTANT_TICK_MS * 20);
    // Nothing moved while nobody was listening.
    expect(store.state.assistant.messages.find((m) => m.id === reply.id)?.text).toBe(paused);
    const rest = await stream(repos, reply.id);
    expect(rest[rest.length - 1]?.status).toBe('complete');
    expect(rest[rest.length - 1]?.text.startsWith(paused)).toBe(true);
  });

  it('clears the thread and nothing else', async () => {
    const resumesBefore = store.state.resumes.length;
    const cleared = await flush(repos.assistant.clear());
    expect(cleared.messages).toEqual([]);
    expect(store.state.resumes).toHaveLength(resumesBefore);
  });
});
