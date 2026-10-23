import type { FaqItem, FaqTopic } from '@nextkin/shared/models';

/**
 * How the Help & support board (Figma 563:4) reads the shared FAQ. The answers are mobile's
 * (`faqFixture`), except where the board writes a web wording into a hidden "shown when open"
 * layer (563:919-921): web points at its own Settings, not the phone's Profile tab.
 */

/** The board's web wordings, by FAQ id. */
const WEB_ANSWER: Partial<Record<string, string>> = {
  faq_export:
    'PDF and plain text on every plan, always clean and never watermarked. DOCX is a Pro format.',
  faq_billing_where:
    'Billing runs on this site, and the receipt arrives by email. You can cancel any time in Settings, under Billing & plan; nothing auto-renews after a trial, because we do not run trials that auto-renew.',
  faq_data:
    'Both, in Settings. Privacy & data builds an archive of your profile, documents and application history and hands you a download. Delete account removes all of it permanently — that one cannot be undone.',
};

export const webAnswer = (item: FaqItem): string => WEB_ANSWER[item.id] ?? item.answer;

/** The filter row: everything, or one topic (563:350). */
export type HelpFilter = 'all' | FaqTopic;

/** The answer the board draws open (577:7332). */
export const DEFAULT_OPEN = 'faq_score';

/**
 * The two columns the board stacks the topics in (577:7278-7410): the short ones down the left,
 * Resumes and Billing down the right.
 */
export const HELP_COLUMNS: readonly (readonly FaqTopic[])[] = [
  ['getting_started', 'jobs', 'account'],
  ['resumes', 'billing'],
];

/** Whether a question, or its answer, holds every word of the search. */
export function matchesSearch(item: FaqItem, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = `${item.question} ${webAnswer(item)}`.toLowerCase();
  return words.every((word) => haystack.includes(word));
}

/** "3 answers", "1 answer". */
export const answerCount = (count: number): string => `${count} answer${count === 1 ? '' : 's'}`;
