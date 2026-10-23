import type { AssistantConversation, AssistantMessage } from '../../models/assistant';
import { assistantConversationSchema, assistantMessageSchema, assistantSendResultSchema, assistantThreadListSchema } from '../../schemas/assistant';
import type { AssistantRepo } from '../types';
import type { HttpClient } from './client';

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
    subscribe(messageId, onChange) {
      let stopped = false;
      let last = '';
      const tick = async () => {
        while (!stopped) {
          try {
            const next = message(await http.request(`/assistant/messages/${messageId}`));
            if (stopped) return;
            const seen = `${next.status}:${next.text.length}`;
            if (seen !== last) {
              last = seen;
              onChange(next);
            }
            if (next.status !== 'streaming') return;
          } catch {
            // A dropped poll is retried on the next tick; the reply itself is unaffected.
          }
          await new Promise((resolve) => setTimeout(resolve, options.everyMs ?? 400));
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
