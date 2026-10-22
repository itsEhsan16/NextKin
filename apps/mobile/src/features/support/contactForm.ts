/**
 * The rules and the wording behind the contact form, with no React in them.
 *
 * The same split as `profile/profileForms.ts`: the screen holds the draft in `useState` and
 * everything that *decides* something about it — whether the message is worth sending, which
 * topic a URL is allowed to seed — lives here so it is unit tested without rendering a page.
 * No react-hook-form and no zod: a topic and a paragraph are not a schema.
 *
 * The copy lives here too, because most of it is a promise (what happens after Send, where the
 * reply lands) and a promise should be readable in one place rather than scattered through JSX.
 */
import {
  SUPPORT_MESSAGE_MAX,
  SUPPORT_REPLY_WINDOW,
  SUPPORT_TOPIC_ORDER,
  type SupportTopic,
} from '@/data/models';

/** What the form opens on when nothing usable was passed in. */
export const CONTACT_DEFAULT_TOPIC: SupportTopic = 'question';

/**
 * The shortest message support can act on. Roughly a short sentence — enough to name a screen
 * and what it did — rather than "help", which costs a reply to ask what happened.
 */
export const CONTACT_MESSAGE_MIN = 12;

/**
 * The topic the form starts on, from a raw URL string.
 *
 * The help screen carries a real `SupportTopic` through, but a deep link can put anything in the
 * query, so the value is matched against the published order rather than trusted and cast. An
 * unknown topic is not an error worth showing anybody — it just opens on "A question".
 */
export function contactTopic(value: string | undefined): SupportTopic {
  return SUPPORT_TOPIC_ORDER.find((topic) => topic === value) ?? CONTACT_DEFAULT_TOPIC;
}

/* ------------------------------------------------------------------- copy */

export const CONTACT_TITLE = 'Message support';
export const CONTACT_CTA = 'Send';
export const CONTACT_DONE = 'Done';

/** The one promise the form owes the reader, set under the hero title (SUPPORT 02 577:7890). */
export const CONTACT_LEDE = SUPPORT_REPLY_WINDOW;

export const CONTACT_TOPIC_LABEL = 'Topic';
export const CONTACT_TOPIC_SHEET = 'What is this about?';
export const CONTACT_TOPIC_HINT = 'Choose what your message is about';

export const CONTACT_EMAIL_GROUP = 'Reply goes to';
export const CONTACT_EMAIL_CAPTION = 'Change it in Account settings.';

export const CONTACT_MESSAGE_LABEL = 'Your message';
export const CONTACT_MESSAGE_PLACEHOLDER = 'What happened?';

/** Said in words rather than "invalid", the way every other form in the app says it. */
export const CONTACT_MESSAGE_BLANK = 'Write your message before sending it.';
export const CONTACT_MESSAGE_SHORT =
  'Add a sentence or two — a few words is not enough to look into.';
export const CONTACT_MESSAGE_LONG = `That is over ${SUPPORT_MESSAGE_MAX} characters. Trim it and send the rest in a second message.`;

/** Nothing was sent, so the button stays live and a second press is the retry. */
export const CONTACT_SEND_FAILED =
  "That didn't send. Your message is still here — press Send again.";

export const CONTACT_SENT_TITLE = 'Message sent';
export const contactSentMessage = (email: string): string =>
  `We have it, and the reply goes to ${email}. ${SUPPORT_REPLY_WINDOW}`;

export const CONTACT_ERROR_TITLE = "Couldn't load your account";
export const CONTACT_ERROR_MESSAGE = 'Check your connection and try again.';

/* ------------------------------------------------------------- validation */

/** The trimmed message travels on the `ok` case, so the caller never re-trims it. */
export type ContactValidation = { ok: true; message: string } | { ok: false; error: string };

export function validateContactMessage(value: string): ContactValidation {
  const message = value.trim();
  // Whitespace is not a message: a field full of newlines would otherwise pass a length check.
  if (message.length === 0) return { ok: false, error: CONTACT_MESSAGE_BLANK };
  if (message.length < CONTACT_MESSAGE_MIN) return { ok: false, error: CONTACT_MESSAGE_SHORT };
  // The field caps typing at the maximum; this is the belt for a paste that arrives past it.
  if (message.length > SUPPORT_MESSAGE_MAX) return { ok: false, error: CONTACT_MESSAGE_LONG };
  return { ok: true, message };
}
