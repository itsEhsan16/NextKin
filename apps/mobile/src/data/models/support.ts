/**
 * NextKin V2 spec §7.14 (help and support) and §8.5 (the legal documents and the rights they
 * describe) — the reference content behind the Support and Legal rows on the Profile tab.
 *
 * No artboard covers any of it (plan §8, phase 9G), so the citations here are spec sections. Both
 * halves are reference data the server will own: the FAQ and the two legal documents are read,
 * never written, and a support ticket is the one thing this file lets the app send.
 */

/** The filter row above the FAQ. Ordered as the help screen draws them. */
export type FaqTopic = 'getting_started' | 'resumes' | 'jobs' | 'billing' | 'account';

export const FAQ_TOPIC_LABEL: Record<FaqTopic, string> = {
  getting_started: 'Getting started',
  resumes: 'Resumes',
  jobs: 'Jobs',
  billing: 'Billing',
  account: 'Account',
};

export const FAQ_TOPIC_ORDER: readonly FaqTopic[] = [
  'getting_started',
  'resumes',
  'jobs',
  'billing',
  'account',
];

export type FaqItem = {
  id: string;
  topic: FaqTopic;
  question: string;
  /** One or two short paragraphs. Plain text — the answer body renders as prose, not markup. */
  answer: string;
};

/**
 * What a ticket is about. Deliberately not the same union as `FaqTopic`: a person writing to us
 * is usually reporting something rather than browsing a category, so "Something is broken" and
 * "Feedback" exist here and nowhere else.
 */
export type SupportTopic = 'question' | 'bug' | 'billing' | 'account' | 'feedback';

export const SUPPORT_TOPIC_LABEL: Record<SupportTopic, string> = {
  question: 'A question',
  bug: 'Something is broken',
  billing: 'Billing or my plan',
  account: 'My account or data',
  feedback: 'Feedback or an idea',
};

export const SUPPORT_TOPIC_ORDER: readonly SupportTopic[] = [
  'question',
  'bug',
  'billing',
  'account',
  'feedback',
];

/** §7.14's published reply window. The contact screen promises this and nothing shorter. */
export const SUPPORT_REPLY_WINDOW = 'We reply within 2 business days.';

/** The longest message the form accepts; the counter under the field reads against it. */
export const SUPPORT_MESSAGE_MAX = 2000;

export type TicketInput = {
  topic: SupportTopic;
  message: string;
};

export type SupportTicket = {
  id: string;
  topic: SupportTopic;
  message: string;
  /** The account address the reply goes to; the form shows it read-only rather than asking. */
  email: string;
  /** ISO-8601 */
  createdAt: string;
};

/** The two documents §8.5 requires to be readable in-product, not only on the web. */
export type LegalDocKey = 'terms' | 'privacy';

export const LEGAL_DOC_TITLE: Record<LegalDocKey, string> = {
  terms: 'Terms of service',
  privacy: 'Privacy policy',
};

export const isLegalDocKey = (value: string): value is LegalDocKey =>
  value === 'terms' || value === 'privacy';

export type LegalSection = {
  id: string;
  heading: string;
  /** Plain-English prose. One or more paragraphs, joined by blank lines. */
  body: string;
};

export type LegalDoc = {
  key: LegalDocKey;
  title: string;
  /** ISO-8601 — the "Last updated" line §8.5 asks every version to carry. */
  updatedAt: string;
  /** The one-paragraph summary that stands above the sections. */
  intro: string;
  sections: LegalSection[];
  /** Where the canonical copy lives; the header's external-link action opens it. */
  url: string;
};
