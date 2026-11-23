import { focusManager } from '@tanstack/react-query';

import type { AssistantConversation, AssistantMessage } from '../../models/assistant';
import { assistantConversationSchema, assistantMessageSchema, assistantSendResultSchema, assistantThreadListSchema } from '../../schemas/assistant';
import type { AssistantRepo } from '../types';
import type { HttpClient } from './client';
import { isPermanentPollError } from './generationsRepo';

/** The server's 3 minutes for a streaming reply, and a margin for the last poll. */
const REPLY_PATIENCE_MS = 3.5 * 60_000;

/**
 * `AssistantRepo` over `/api/v1/assistant` (ImBackendImplementationPlan P11-09). Every method is
 * served, and there is still no verb that writes user data. A reply arrives empty and streaming;
 * `subscribe` reads it as it grows (polling, the transport Expo Go is known to run) and stops at a
 * terminal status. The day's cap answers `RATE_LIMITED` with `resetsAt` in its details.
 */
const conversation = (data: unknown) => assistantConversationSchema.parse(data) as AssistantConversation;
const message = (data: unknown) => assistantMessageSchema.parse(data) as AssistantMessage;

export function createHttpAssistantRepo(http: HttpClient, options: { everyMs?: number } = {}): AssistantRepo {
  return {
    getConversation: async () => conversation(await http.request('/assistant/sessions/current')),
    async send(input) {
      const sent = assistantSendResultSchema.parse(await http.request('/assistant/messages', { body: input }));
      return sent as { user: AssistantMessage; reply: AssistantMessage };
    },
    subscribe(messageId, onChange, onGiveUp) {
      let stopped = false;
      let last = '';
      const every = options.everyMs ?? 400;
      const began = Date.now();
      const tick = async () => {
        let failures = 0;
        while (!stopped) {
          await whileAway(() => stopped, every);
          if (stopped) return;
          // The server calls a reply still streaming after 3 minutes failed; past that and a
          // margin, the screen stops waiting too, instead of "Thinking…" for ever (toreview §260).
          if (Date.now() - began > REPLY_PATIENCE_MS) {
            onGiveUp?.();
            return;
          }
          try {
            const next = message(await http.request(`/assistant/messages/${messageId}`));
            if (stopped) return;
            failures = 0;
            const seen = `${next.status}:${next.text.length}`;
            if (seen !== last) {
              last = seen;
              onChange(next);
            }
            if (next.status !== 'streaming') return;
          } catch (error) {
            // A reply that is gone or unreadable won't come right by asking again.
            if (isPermanentPollError(error)) {
              onGiveUp?.();
              return;
            }
            // A dropped poll is retried, with a growing wait.
            failures++;
            await new Promise((resolve) => setTimeout(resolve, every * Math.min(2 ** failures, 25)));
            continue;
          }
          await new Promise((resolve) => setTimeout(resolve, every));
        }
      };
      void tick();
      return () => {
        stopped = true;
      };
    },
    clear: async () => conversation(await http.request('/assistant/sessions/current/clear', { method: 'POST' })),
    listThreads: async () => assistantThreadListSchema.parse(await http.request('/assistant/sessions')).data,
    openThread: async (id) => conversation(await http.request(`/assistant/sessions/${id}/open`, { method: 'POST' })),
    startNew: async () => conversation(await http.request('/assistant/sessions', { method: 'POST' })),
  };
}

/**
 * Waits while the app is in the background (§196): a poll there spends battery and data on an
 * answer nobody is looking at. `focusManager` follows the app's state on the phone and the tab's
 * visibility on the web; when it comes back the poll resumes at once.
 */
async function whileAway(stopped: () => boolean, everyMs: number): Promise<void> {
  while (!stopped() && !focusManager.isFocused()) {
    await new Promise((resolve) => setTimeout(resolve, everyMs));
  }
}
