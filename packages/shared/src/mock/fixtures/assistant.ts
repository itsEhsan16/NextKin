import type { AssistantConversation } from '@/data/models/assistant';

import { REFUSAL_LINE } from '../assistantDomain';
import { daysAgo, hoursAgo } from './time';

/**
 * NextKin V2 spec §7.16 — the one conversation the account keeps.
 *
 * Seeded with a short thread rather than left empty: one on-topic exchange and one refusal, so
 * both bubble treatments are visible on first open and `assistantMessagesUsed: 12` in
 * fixtures/user.ts is not a bare assertion. The suggested prompts still show — they are offered
 * whenever the composer is empty, not only on a blank thread.
 */
export const conversationFixture: AssistantConversation = {
  id: 'conv_main',
  createdAt: daysAgo(6),
  updatedAt: hoursAgo(20),
  messages: [
    {
      id: 'msg_1',
      role: 'user',
      text: 'How do I explain a two-year gap on my resume?',
      createdAt: daysAgo(6),
      status: 'complete',
    },
    {
      id: 'msg_2',
      role: 'assistant',
      text: "In one honest sentence in your summary, not buried in the dates: say what you did with the time and what you're moving towards. Interviewers notice a gap; they hold it against you only when it looks hidden. If you kept skills warm — freelance, a course, caring for someone — name it plainly; it counts.",
      createdAt: daysAgo(6),
      status: 'complete',
    },
    {
      id: 'msg_3',
      role: 'user',
      text: "What's the weather like in Bengaluru today?",
      createdAt: hoursAgo(20),
      status: 'complete',
    },
    {
      id: 'msg_4',
      role: 'assistant',
      text: REFUSAL_LINE,
      createdAt: hoursAgo(20),
      status: 'complete',
      refusal: 'off_topic',
    },
  ],
};
