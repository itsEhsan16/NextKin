/**
 * NextKin V2 spec §7.16 — the AI career assistant.
 *
 * Mobile keeps one conversation per user: §7.16 asks for "persistent conversation history per
 * user", and that is what it gets. The web boards (767:2, 767:275, 772:2, 772:165) add a History
 * of earlier chats beside it; those are past conversations the user can reopen, and the one
 * being written to is still the one `getConversation` returns. The assistant is read-and-advise
 * only — nothing in this model, or in `AssistantRepo`, can change user data.
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
  /** What the user attached to this turn (web 772:165). Read, never changed. */
  attachments?: AssistantAttachment[];
};

/**
 * Something the user added to a message from the web composer's attach menu (772:2): one of their
 * resumes, a cover letter from Documents, a saved job, or a file from their computer. The
 * assistant reads it; nothing it is attached to can be changed through it.
 */
export type AssistantAttachmentKind = 'resume' | 'cover_letter' | 'job' | 'file';

export type AssistantAttachment = {
  kind: AssistantAttachmentKind;
  /** The resume, document or job id; the file name for an uploaded file. */
  id: string;
  title: string;
  /** The chip's second line: "Resume on NextKin · 1 page", "Saved job". */
  detail: string;
};

export type AssistantConversation = {
  id: string;
  /**
   * What the history list calls it (web 767:2). Unset on a new chat until its first message,
   * which then names it.
   */
  title?: string;
  /** ISO-8601 */
  createdAt: string;
  updatedAt: string;
  messages: AssistantMessage[];
};

/** One row of the web assistant's History (767:2): a chat, by its title and its first answer. */
export type AssistantThreadSummary = {
  id: string;
  title: string;
  /** The opening of the first answer, or empty while there is none. */
  preview: string;
  /** ISO-8601 */
  updatedAt: string;
  /** The chat the composer writes to. */
  current: boolean;
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
