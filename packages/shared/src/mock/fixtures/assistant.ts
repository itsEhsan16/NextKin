import type { AssistantConversation } from '../../models/assistant';

import { REFUSAL_LINE } from '../assistantDomain';
import { daysAgo, earlierToday } from './time';

/**
 * NextKin V2 spec §7.16 — the conversation the account is in.
 *
 * Seeded with a short thread rather than left empty: one on-topic exchange and one refusal, so
 * both bubble treatments are visible on first open and `assistantMessagesUsed: 12` in
 * fixtures/user.ts is not a bare assertion. The suggested prompts still show — they are offered
 * whenever the composer is empty, not only on a blank thread. Both turns are today's, under the
 * web boards' one "Today" divider, and the History calls it what 767:275 does.
 */
export const conversationFixture: AssistantConversation = {
  id: 'conv_main',
  title: 'Explaining a two-year gap',
  createdAt: earlierToday(3),
  updatedAt: earlierToday(1),
  messages: [
    {
      id: 'msg_1',
      role: 'user',
      text: 'How do I explain a two-year gap on my resume?',
      createdAt: earlierToday(3),
      status: 'complete',
    },
    {
      id: 'msg_2',
      role: 'assistant',
      text: "In one honest sentence in your summary, not buried in the dates: say what you did with the time and what you're moving towards. Interviewers notice a gap; they hold it against you only when it looks hidden. If you kept skills warm — freelance, a course, caring for someone — name it plainly; it counts.",
      createdAt: earlierToday(3),
      status: 'complete',
    },
    {
      id: 'msg_3',
      role: 'user',
      text: "What's the weather like in Bengaluru today?",
      createdAt: earlierToday(1),
      status: 'complete',
    },
    {
      id: 'msg_4',
      role: 'assistant',
      text: REFUSAL_LINE,
      createdAt: earlierToday(1),
      status: 'complete',
      refusal: 'off_topic',
    },
  ],
};

type Past = { id: string; title: string; question: string; answer: string; at: string };

const past = ({ id, title, question, answer, at }: Past): AssistantConversation => ({
  id,
  title,
  createdAt: at,
  updatedAt: at,
  messages: [
    { id: `${id}_q`, role: 'user', text: question, createdAt: at, status: 'complete' },
    { id: `${id}_a`, role: 'assistant', text: answer, createdAt: at, status: 'complete' },
  ],
});

/**
 * The web History's five earlier chats (767:2), newest first, each opening with the line its row
 * previews. Their dates sit where the board's labels put them on 9 October: yesterday, two days,
 * a week, 28 and 21 September.
 */
export const assistantHistoryFixture: AssistantConversation[] = [
  past({
    id: 'conv_ats72',
    title: 'Why my ATS score is 72',
    question: 'Why is my ATS score 72?',
    answer:
      "Your score is held back by three keywords the job description repeats and your resume never uses: design systems, usability testing and stakeholder management. If they are true of your work, say so in the bullets where you did them, not in a list at the bottom. The score measures your document against NextKin's own rubric; it is not a prediction of how any employer's software will read it.",
    at: daysAgo(1),
  }),
  past({
    id: 'conv_tmay',
    title: 'Answering “tell me about yourself”',
    question: 'How should I answer "tell me about yourself"?',
    answer:
      'Start with what you do now, then one proof of it, then why this role is the next step. Keep it under two minutes and leave out anything already on your resume that does not lead to the job in front of you.',
    at: daysAgo(2),
  }),
  past({
    id: 'conv_stripe',
    title: 'Preparing for the Stripe interview',
    question: 'What should I expect in a Stripe product design interview?',
    answer:
      'Expect a portfolio walkthrough and a whiteboard exercise. Pick two projects you can explain end to end: the problem, what you tried, what you shipped and what you would change. For the exercise, talk through your thinking out loud; they are watching how you get there.',
    at: daysAgo(7),
  }),
  past({
    id: 'conv_razorpay',
    title: 'Cover letter tone for Razorpay',
    question: 'What tone should my cover letter for Razorpay have?',
    answer:
      'Keep it confident and short — three paragraphs: why Razorpay, what you have done that matches the role, and what you would bring in your first months. Plain words over adjectives; let one result with a number carry the middle paragraph.',
    at: daysAgo(11),
  }),
  past({
    id: 'conv_freelance',
    title: 'Should I list freelance work?',
    question: 'Should I list freelance work on my resume?',
    answer:
      'Yes, as one role with dated projects under it: "Freelance Product Designer", the dates, then two or three clients with what you delivered for each. It reads as continuous experience, and it is.',
    at: daysAgo(18),
  }),
];
