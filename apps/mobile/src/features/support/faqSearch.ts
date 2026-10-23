/**
 * The rules behind the help screen's search, with no React in them.
 *
 * The FAQ is a dozen entries the repo hands over whole (`supportRepo.listFaq`), so the filtering
 * happens here rather than on the server: a round trip per keystroke would be a worse product for
 * no gain. The screen holds the query and the topic in `useState` and everything that *decides*
 * what is on screen lives in this module, so it is unit tested without rendering a page — the same
 * split as `profile/profileForms.ts`. No zod and no schema library: these are the product's rules.
 */
import type { FaqItem, FaqTopic, SupportTopic } from '@/data/models';

export type FaqFilter = {
  /** Undefined is the "All" chip — no topic narrowing at all. */
  topic?: FaqTopic;
  query?: string;
};

/**
 * Trim, collapse runs of whitespace, lower-case. Someone typing "  raise   my score " is asking
 * the same question as someone typing "raise my score", and a stray double space should not empty
 * the page.
 */
export const normaliseFaqQuery = (query: string): string =>
  query.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * Both halves of an entry are searched, not just the question. Someone typing "watermark" is
 * looking for the export answer, and that word only appears in its body — a search that read the
 * questions alone would tell them we have nothing to say about it.
 */
const haystack = (item: FaqItem): string => `${item.question}\n${item.answer}`.toLowerCase();

export const faqMatches = (item: FaqItem, query: string): boolean => {
  const needle = normaliseFaqQuery(query);
  return needle.length === 0 || haystack(item).includes(needle);
};

/** Fixture order is editorial order — the topics group, so matches are never re-sorted. */
export function filterFaq(items: readonly FaqItem[], filter: FaqFilter = {}): FaqItem[] {
  const needle = normaliseFaqQuery(filter.query ?? '');
  return items.filter(
    (item) =>
      (filter.topic === undefined || item.topic === filter.topic) &&
      (needle.length === 0 || haystack(item).includes(needle)),
  );
}

/** How many entries the current search and topic leave standing. */
export const faqMatchCount = (items: readonly FaqItem[], filter: FaqFilter = {}): number =>
  filterFaq(items, filter).length;

/** The line above the list. Says "of" only while something is actually narrowing the list. */
export function faqCountLine(matched: number, total: number): string {
  const noun = total === 1 ? 'answer' : 'answers';
  if (matched === total) return `${total} ${noun}`;
  return `${matched} of ${total} ${noun}`;
}

/** A topic group's count — "3 answers" beside its heading (SUPPORT 01 577:6180). */
export const faqAnswersLabel = (count: number): string =>
  `${count} ${count === 1 ? 'answer' : 'answers'}`;

const COUNT_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

/**
 * The hero's lede (SUPPORT 01 577:6156). Whole, it says how much help there is — "14 answers
 * across five topics." — counting the topics the content actually covers rather than the five the
 * model publishes. While a search or a topic narrows the list it becomes the count line instead,
 * so the one line under the title always says what is on the page.
 */
export function faqHeroLine(items: readonly FaqItem[], matched: number): string {
  const total = items.length;
  if (matched !== total) return faqCountLine(matched, total);
  const topics = new Set(items.map((item) => item.topic)).size;
  const word = COUNT_WORDS[topics] ?? String(topics);
  return `${faqCountLine(total, total)} across ${word} ${topics === 1 ? 'topic' : 'topics'}.`;
}

/**
 * The FAQ's topics and the contact form's subjects are different unions on purpose (see
 * `models/support.ts`): browsing categories are not the same as reasons to write in. Only two line
 * up, so only two are mapped.
 *
 * "Getting started", "Resumes" and "Jobs" are deliberately absent rather than pointed at
 * `question`: `question` is already the form's default, so mapping them would carry nothing
 * through while implying we knew more about the reader's subject than we do.
 */
export const FAQ_TOPIC_TO_SUPPORT_TOPIC: Partial<Record<FaqTopic, SupportTopic>> = {
  billing: 'billing',
  account: 'account',
};

export const supportTopicForFaqTopic = (topic?: FaqTopic): SupportTopic | undefined =>
  topic === undefined ? undefined : FAQ_TOPIC_TO_SUPPORT_TOPIC[topic];
