import {
  answerFor,
  buildAssistantContext,
  classify,
  getMockMode,
  newId,
  REFUSAL_LINE,
  simulate,
  type AssistantContext,
} from '@/data/mock';
import type { AssistantConversation, AssistantMessage } from '@/data/models';

import { clone, type MockStore } from './state';
import type { AssistantRepo, Unsubscribe } from './types';

/**
 * NextKin V2 spec §7.16 — the assistant, read-and-advise only.
 *
 * The interface has no verb that writes user data — no regenerate, no edit, no delete of a
 * message, nothing that touches a resume or the profile. That is the cheapest possible proof of
 * §7.16's "the assistant cannot take actions" acceptance criterion: there is no way to.
 *
 * Streaming is the generations ticker, borrowed whole: `send` composes the entire reply, splits
 * it into tokens and stores the assistant turn with EMPTY text; `subscribe` starts an interval on
 * the first listener that appends tokens and emits the growing message, and tears itself down
 * when the last listener leaves. The token buffer lives in this closure, never in `MockState` —
 * it is transport, not data. Like the generation ticker, it only advances while something is
 * subscribed: leaving mid-reply pauses, coming back resumes from where it got to.
 *
 * Refusals do not stream. A refusal that typed itself out slowly would read as the model
 * "thinking about" a question it has declined; it arrives whole.
 */

export const ASSISTANT_TICK_MS = 45;
const TOKENS_PER_TICK = 2;

type Streamer = {
  timer: ReturnType<typeof setInterval>;
  tokens: string[];
  cursor: number;
  listeners: Set<(message: AssistantMessage) => void>;
};

/** Split so that re-joining is exact: the whitespace is kept as its own tokens. */
const tokenise = (text: string): string[] => text.split(/(\s+)/).filter((part) => part.length > 0);

export function createMockAssistantRepo(store: MockStore): AssistantRepo {
  /** Token buffers by message id. Filled by `send`, drained by the ticker, never persisted. */
  const pending = new Map<string, string[]>();
  const streamers = new Map<string, Streamer>();

  const conversation = (): AssistantConversation => store.state.assistant;

  const writeMessage = (next: AssistantMessage): void => {
    const current = conversation();
    store.state.assistant = {
      ...current,
      updatedAt: next.createdAt,
      messages: current.messages.map((message) => (message.id === next.id ? next : message)),
    };
  };

  const stop = (id: string): void => {
    const streamer = streamers.get(id);
    if (!streamer) return;
    clearInterval(streamer.timer);
    streamers.delete(id);
  };

  const tick = (id: string): void => {
    const streamer = streamers.get(id);
    const current = conversation().messages.find((message) => message.id === id);
    if (!streamer || !current || current.status !== 'streaming') return stop(id);

    // Read at tick time, like the generation ticker: flipping the dev toggle mid-reply stops it
    // where it got to, which is the "That answer stopped part-way" state the screen shows.
    if (getMockMode() === 'error') {
      const failed: AssistantMessage = { ...current, status: 'failed' };
      writeMessage(failed);
      stop(id);
      streamer.listeners.forEach((listener) => listener(clone(failed)));
      return;
    }

    const nextCursor = Math.min(streamer.tokens.length, streamer.cursor + TOKENS_PER_TICK);
    const text = streamer.tokens.slice(0, nextCursor).join('');
    const done = nextCursor >= streamer.tokens.length;
    streamer.cursor = nextCursor;
    const next: AssistantMessage = { ...current, text, status: done ? 'complete' : 'streaming' };
    writeMessage(next);
    if (done) {
      pending.delete(id);
      stop(id);
    }
    streamer.listeners.forEach((listener) => listener(clone(next)));
  };

  const contextFor = (resumeId: string | undefined): AssistantContext | undefined => {
    if (!resumeId) return undefined;
    const resume = store.state.resumes.find((item) => item.id === resumeId);
    if (!resume) return undefined;
    return buildAssistantContext({
      resume,
      content: store.state.contents[resumeId],
      score: store.state.atsScores[resumeId],
    });
  };

  return {
    getConversation: () => simulate(() => clone(conversation())),

    send: (input) =>
      simulate(() => {
        const now = new Date().toISOString();
        const text = input.text.trim();
        const user: AssistantMessage = {
          id: newId('msg'),
          role: 'user',
          text,
          createdAt: now,
          status: 'complete',
          ...(input.resumeId ? { contextResumeId: input.resumeId } : {}),
        };

        const verdict = classify(text);
        const reply: AssistantMessage = verdict.allowed
          ? {
              id: newId('msg'),
              role: 'assistant',
              text: '',
              createdAt: now,
              status: 'streaming',
              ...(input.resumeId ? { contextResumeId: input.resumeId } : {}),
            }
          : {
              id: newId('msg'),
              role: 'assistant',
              text: REFUSAL_LINE,
              createdAt: now,
              status: 'complete',
              refusal: 'off_topic',
            };

        if (verdict.allowed) {
          pending.set(reply.id, tokenise(answerFor(verdict.topic, contextFor(input.resumeId))));
        }

        const current = conversation();
        store.state.assistant = {
          ...current,
          updatedAt: now,
          messages: [...current.messages, user, reply],
        };

        // §13.3's meter. A refusal counts: the turn happened, and a meter that disagreed with the
        // transcript would be worse. Nothing throws on a spent cap — §13.5 gates in the UI first.
        const usage = { ...store.state.subscription.usage };
        usage.assistantMessagesUsed = (usage.assistantMessagesUsed ?? 0) + 1;
        store.state.subscription = { ...store.state.subscription, usage };

        return { user: clone(user), reply: clone(reply) };
      }),

    subscribe: (messageId, onChange): Unsubscribe => {
      const current = conversation().messages.find((message) => message.id === messageId);
      const tokens = pending.get(messageId);
      if (!current || current.status !== 'streaming' || !tokens) return () => {};

      const streamer =
        streamers.get(messageId) ??
        (() => {
          const created: Streamer = {
            tokens,
            cursor: tokenise(current.text).length,
            listeners: new Set(),
            timer: setInterval(() => tick(messageId), ASSISTANT_TICK_MS),
          };
          streamers.set(messageId, created);
          return created;
        })();
      streamer.listeners.add(onChange);

      return () => {
        streamer.listeners.delete(onChange);
        if (streamer.listeners.size === 0) stop(messageId);
      };
    },

    clear: () =>
      simulate(() => {
        streamers.forEach((_streamer, id) => stop(id));
        pending.clear();
        const now = new Date().toISOString();
        store.state.assistant = { ...conversation(), updatedAt: now, messages: [] };
        return clone(store.state.assistant);
      }),
  };
}
