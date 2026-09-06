import { faqFixture } from '@/data/mock';
import { FAQ_TOPIC_ORDER, SUPPORT_TOPIC_ORDER, type FaqItem } from '@/data/models';
import {
  FAQ_TOPIC_TO_SUPPORT_TOPIC,
  faqCountLine,
  faqMatchCount,
  faqMatches,
  filterFaq,
  normaliseFaqQuery,
  supportTopicForFaqTopic,
} from '@/features/support/faqSearch';

const ids = (items: readonly FaqItem[]) => items.map((item) => item.id);

describe('filterFaq (V2 §7.14)', () => {
  it('returns everything, in fixture order, with no topic and no query', () => {
    expect(ids(filterFaq(faqFixture))).toEqual(ids(faqFixture));
    expect(ids(filterFaq(faqFixture, { topic: undefined, query: '' }))).toEqual(ids(faqFixture));
  });

  it('narrows to one topic and keeps the editorial order inside it', () => {
    const billing = filterFaq(faqFixture, { topic: 'billing' });

    expect(ids(billing)).toEqual(['faq_quota', 'faq_billing_where']);
    expect(billing.every((item) => item.topic === 'billing')).toBe(true);
    // Every topic on the chip row leads somewhere; an empty chip would be a dead end.
    for (const topic of FAQ_TOPIC_ORDER) {
      expect(filterFaq(faqFixture, { topic }).length).toBeGreaterThan(0);
    }
  });

  it('matches a question case-insensitively', () => {
    expect(ids(filterFaq(faqFixture, { query: 'LINKEDIN' }))).toContain('faq_linkedin');
    expect(ids(filterFaq(faqFixture, { query: 'raise my score' }))).toEqual(['faq_score_move']);
  });

  it('matches a word that only appears in the answer body', () => {
    // "watermark" is nowhere in any question — a search that read titles alone would say we have
    // nothing to tell someone worried about a watermarked export.
    expect(faqFixture.some((item) => item.question.toLowerCase().includes('watermark'))).toBe(
      false,
    );
    expect(ids(filterFaq(faqFixture, { query: 'watermark' }))).toEqual(['faq_export']);
  });

  it('trims and collapses whitespace before matching', () => {
    expect(normaliseFaqQuery('  Raise   MY  score ')).toBe('raise my score');
    expect(ids(filterFaq(faqFixture, { query: '  raise   my score  ' }))).toEqual([
      'faq_score_move',
    ]);
    // Whitespace alone is not a search; it must not empty the page.
    expect(filterFaq(faqFixture, { query: '   ' })).toHaveLength(faqFixture.length);
  });

  it('combines the topic and the query, and can legitimately match nothing', () => {
    expect(filterFaq(faqFixture, { topic: 'billing', query: 'linkedin' })).toHaveLength(0);
    expect(filterFaq(faqFixture, { query: 'kombucha' })).toHaveLength(0);
    expect(faqMatches(faqFixture[3] as FaqItem, '')).toBe(true);
  });
});

describe('the count line', () => {
  it('counts what the current filter leaves standing', () => {
    expect(faqMatchCount(faqFixture)).toBe(faqFixture.length);
    expect(faqMatchCount(faqFixture, { topic: 'billing' })).toBe(2);
    expect(faqMatchCount(faqFixture, { query: 'kombucha' })).toBe(0);
  });

  it('says "of" only while something is narrowing the list', () => {
    expect(faqCountLine(14, 14)).toBe('14 answers');
    expect(faqCountLine(2, 14)).toBe('2 of 14 answers');
    expect(faqCountLine(1, 1)).toBe('1 answer');
    expect(faqCountLine(0, 14)).toBe('0 of 14 answers');
  });
});

describe('the FAQ topic → support topic map', () => {
  it('carries through only the two subjects that actually line up', () => {
    expect(supportTopicForFaqTopic('billing')).toBe('billing');
    expect(supportTopicForFaqTopic('account')).toBe('account');
  });

  it('passes nothing rather than guessing where the unions do not meet', () => {
    expect(supportTopicForFaqTopic(undefined)).toBeUndefined();
    expect(supportTopicForFaqTopic('getting_started')).toBeUndefined();
    expect(supportTopicForFaqTopic('resumes')).toBeUndefined();
    expect(supportTopicForFaqTopic('jobs')).toBeUndefined();
  });

  it('only ever names topics the contact form actually offers', () => {
    for (const mapped of Object.values(FAQ_TOPIC_TO_SUPPORT_TOPIC)) {
      expect(SUPPORT_TOPIC_ORDER).toContain(mapped);
    }
  });
});
