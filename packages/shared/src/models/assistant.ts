/**
 * NextKin V2 spec §7.16 — the AI career assistant.
 *
 * Release 1 is one conversation per user, not a thread list: §7.16 asks for "persistent
 * conversation history per user", and that is what it gets. The assistant is read-and-advise
 * only — nothing in this model, or in `AssistantRepo`, can change user data.
 *
 * No artboard covers it (plan §8, phase 9I); the citations are spec sections.
 */

export type AssistantRole = 'user' | 'assistant';

/**
 * §7.16 logs refusals by topic class only, never the message. This is the whole of what is kept.
 */
export type AssistantRefusalReason = 'off_topic';

export type AssistantMessageStatus = 'streaming' | 'complete' | 'failed';

export type AssistantMessage = {
  id: string;
  role: AssistantRole;
  /** Grows token by token while `status === 'streaming'`. */
  text: string;
  /** ISO-8601 */
  createdAt: string;
  status: AssistantMessageStatus;
  refusal?: AssistantRefusalReason;
  /** The document this turn was answered against (§7.16's context awareness). */
  contextResumeId?: string;
};

export type AssistantConversation = {
  id: string;
  /** ISO-8601 */
  createdAt: string;
  updatedAt: string;
  messages: AssistantMessage[];
};

/** §7.16's first-use prompts, in the product's voice. */
export const ASSISTANT_SUGGESTIONS: readonly string[] = [
  'Why is my ATS score what it is?',
  'How do I explain a career gap?',
  'What does "ATS-optimised" actually mean?',
  'How should I answer "tell me about yourself"?',
];

/** Restated in every refusal: §7.16 wants the decline to say what the assistant CAN do. */
export const ASSISTANT_SCOPE_LINE =
  'I can help with your job search, resumes and cover letters, ATS scores, interview preparation, and skills and career paths.';

/** §7.16: "clear labeling that responses are AI-generated guidance, not professional or legal advice". */
export const ASSISTANT_DISCLAIMER = 'AI-generated guidance, not professional or legal advice.';
