import {
  answerFor,
  buildAssistantContext,
  classify,
  getMockMode,
  greetingAnswer,
  greetingKind,
  newId,
  REFUSAL_LINE,
  simulate,
  type AssistantContext,
} from '../mock';
import type { AssistantConversation, AssistantMessage, AssistantThreadSummary } from '../models';

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

/** A new chat is named by its first question, cut at a word near the History row's width. */
const TITLE_MAX = 40;
export const titleFor = (text: string): string => {
  const line = text.trim().replace(/\s+/g, ' ');
  if (line.length <= TITLE_MAX) return line;
  const cut = line.slice(0, TITLE_MAX);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 20)).replace(/[\s,.;:]+$/, '')}…`;
};

const summaryOf = (chat: AssistantConversation, current: boolean): AssistantThreadSummary => ({
  id: chat.id,
  title: chat.title ?? titleFor(chat.messages.find((m) => m.role === 'user')?.text ?? 'New chat'),
  preview: chat.messages.find((m) => m.role === 'assistant' && m.text.length > 0)?.text ?? '',
  updatedAt: chat.updatedAt,
  current,
});

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
    const next: AssistantMessage = {
      ...current,
      text,
      status: done ? 'complete' : 'streaming',
    };
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
          ...(input.attachments?.length ? { attachments: clone(input.attachments) } : {}),
        };

        // A greeting is answered with a short hello, and, as on the server, does not count.
        const greeting = greetingKind(text);
        const verdict = classify(text);
        const answered = greeting !== null || verdict.allowed;
        const reply: AssistantMessage = answered
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

        if (greeting) {
          pending.set(reply.id, tokenise(greetingAnswer(greeting, contextFor(input.resumeId))));
        } else if (verdict.allowed) {
          pending.set(reply.id, tokenise(answerFor(verdict.topic, contextFor(input.resumeId))));
        }

        const current = conversation();
        store.state.assistant = {
          ...current,
          // A new chat takes its name from its first question (the History row, 767:2).
          title: current.title ?? titleFor(text),
          updatedAt: now,
          messages: [...current.messages, user, reply],
        };

        // §13.3's meter. A refusal counts: the turn happened, and a meter that disagreed with the
        // transcript would be worse. Nothing throws on a spent cap — §13.5 gates in the UI first.
        if (!greeting) {
          const usage = { ...store.state.subscription.usage };
          usage.assistantMessagesUsed = (usage.assistantMessagesUsed ?? 0) + 1;
          store.state.subscription = { ...store.state.subscription, usage };
        }

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
        // A cleared chat is a new one, and will be named by its next first question.
        const { title: _title, ...rest } = conversation();
        store.state.assistant = { ...rest, updatedAt: now, messages: [] };
        return clone(store.state.assistant);
      }),

    listThreads: () =>
      simulate(() => {
        const current = conversation();
        const rows = current.messages.length > 0 ? [summaryOf(current, true)] : [];
        return clone([...rows, ...store.state.assistantHistory.map((c) => summaryOf(c, false))]);
      }),

    openThread: (id) =>
      simulate(() => {
        const current = conversation();
        if (current.id === id) return clone(current);
        const chosen = store.state.assistantHistory.find((chat) => chat.id === id);
        if (!chosen) throw new Error(`Chat ${id} not found`);
        streamers.forEach((_streamer, live) => stop(live));
        const rest = store.state.assistantHistory.filter((chat) => chat.id !== id);
        store.state.assistantHistory = byNewest(
          current.messages.length > 0 ? [current, ...rest] : rest,
        );
        store.state.assistant = chosen;
        return clone(chosen);
      }),

    startNew: () =>
      simulate(() => {
        const current = conversation();
        if (current.messages.length === 0) return clone(current);
        streamers.forEach((_streamer, live) => stop(live));
        store.state.assistantHistory = byNewest([current, ...store.state.assistantHistory]);
        const now = new Date().toISOString();
        store.state.assistant = { id: newId('conv'), createdAt: now, updatedAt: now, messages: [] };
        return clone(store.state.assistant);
      }),
  };
}

const byNewest = (chats: AssistantConversation[]): AssistantConversation[] =>
  [...chats].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
