import { atsScoresFixture } from '@/data/mock';
import { rescore, scoreFromKeywords } from '@/data/mock/atsScoreBuilder';
import type { AtsCheckItem, AtsScore } from '@/data/models';
import type { CoverLetterContent, ResumeContent } from '@/data/models/resumeContent';

/** RESUMES 04 verbatim — the one summary that must survive a no-op edit. */
const BASE_SUMMARY = 'Parsers will read this cleanly. Four quick wins left before it is airtight.';

/** The totals the RESUMES artboards ship with; moving the builder must not shift one of them. */
const EXPECTED_TOTALS: Record<string, number> = {
  res_base: 92,
  res_1: 92,
  res_2: 88,
  res_5: 84,
  res_3: 76,
  res_4: 81,
  res_zoho: 69,
  res_atlassian: 87,
};

const fixtureScore = (id: string): AtsScore => {
  const score: AtsScore | undefined = atsScoresFixture[id];
  if (!score) throw new Error(`No fixture ATS score for "${id}"`);
  return score;
};

const itemById = (score: AtsScore, id: string): AtsCheckItem | undefined =>
  score.sections.flatMap((section) => section.items).find((item) => item.id === id);

/**
 * George's base resume as the editor holds it: two unquantified bullets, no portfolio link and
 * neither of the keywords res_base is missing — so every flippable check reads exactly as the
 * fixture scored it.
 */
const resumeContent = (overrides: Partial<ResumeContent> = {}): ResumeContent => ({
  kind: 'resume',
  resumeId: 'res_base',
  versionId: 'ver_base_5',
  summary: 'Senior UX designer, 8 years across Flipkart, Swiggy and PhonePe.',
  skills: ['Figma', 'Design systems', 'User research'],
  experience: [
    {
      id: 'exp_1',
      company: 'Flipkart',
      title: 'Senior UX Designer',
      period: 'Mar 2022 — Present',
      bullets: [
        'Led the design system rollout across the shopping app.',
        'Ran research with sellers in Bengaluru and Pune.',
      ],
    },
  ],
  projects: [],
  certifications: [],
  education: [],
  ...overrides,
});

const coverLetterContent: CoverLetterContent = {
  kind: 'cover_letter',
  resumeId: 'res_cover_stripe',
  versionId: 'ver_cs_1',
  tone: 'professional',
  greeting: 'Dear hiring team,',
  paragraphs: ['Eight years of product and UX work, most of it on payments.'],
  signoff: 'George Smith',
};

describe('atsScoreBuilder', () => {
  describe('the move out of the fixtures', () => {
    it('keeps every artboard total', () => {
      expect(Object.keys(atsScoresFixture)).toHaveLength(Object.keys(EXPECTED_TOTALS).length);
      for (const [id, total] of Object.entries(EXPECTED_TOTALS)) {
        expect(fixtureScore(id).total).toBe(total);
      }
    });

    it('keeps the base resume on its verbatim RESUMES 04 line', () => {
      const base = fixtureScore('res_base');

      expect(base.total).toBe(92);
      expect(base.summary).toBe(BASE_SUMMARY);
      expect(base.band).toBe('strong');
    });

    it('gives a seeded quick win the same fix target a generated one gets', () => {
      const item = itemById(fixtureScore('res_base'), 'kw_miss_0');

      expect(item?.suggestion).toBe('Add "stakeholder management" to your skills');
      expect(item?.section).toBe('skills');
      expect(itemById(fixtureScore('res_base'), 'portfolio')?.section).toBe('links');
    });
  });

  describe('scoreFromKeywords', () => {
    const present = ['design systems', 'user research'];

    it('scores a full keyword match into the strong band', () => {
      const score = scoreFromKeywords({ present, missing: [] });

      expect(score.total).toBeGreaterThanOrEqual(85);
      expect(score.band).toBe('strong');
    });

    it('charges four points per missing keyword, deterministically', () => {
      const clean = scoreFromKeywords({ present, missing: [] });
      const one = scoreFromKeywords({ present, missing: ['A/B testing'] });
      const two = scoreFromKeywords({ present, missing: ['A/B testing', 'governance'] });

      expect(one.total).toBe(clean.total - 4);
      expect(two.total).toBe(clean.total - 8);
      expect(scoreFromKeywords({ present, missing: ['A/B testing'] })).toEqual(one);
    });

    it('turns a missing keyword into a fix that lands in skills', () => {
      const score = scoreFromKeywords({ present, missing: ['A/B testing'] });
      const item = itemById(score, 'kw_miss_0');

      expect(item?.label).toBe('Missing: "A/B testing"');
      expect(item?.fixable).toBe(true);
      expect(item?.suggestion).toBe('Add "A/B testing" to your skills');
      expect(item?.section).toBe('skills');
    });

    it('claims no keyword match the document did not make (V2 §7.8)', () => {
      const none = scoreFromKeywords({ present: [], missing: [] });
      const one = scoreFromKeywords({ present: ['design systems'], missing: [] });

      expect(itemById(none, 'kw_1')).toBeUndefined();
      expect(itemById(none, 'kw_2')).toBeUndefined();
      expect(itemById(one, 'kw_1')?.label).toBe('"design systems" appears 3 times');
      expect(itemById(one, 'kw_2')).toBeUndefined();
    });

    it('shows an unsupported keyword as an unfixable gap (V2 §7.8)', () => {
      const score = scoreFromKeywords({ present, missing: [], unsupported: ['Kubernetes'] });
      const gap = itemById(score, 'kw_gap_0');

      expect(gap?.label).toBe('"Kubernetes" is not in your profile');
      expect(gap?.supported).toBe(false);
      expect(gap?.fixable).toBeFalsy();
      expect(gap?.passed).toBe(false);
    });
  });

  describe('rescore', () => {
    it('leaves an unchanged document alone, and repeats itself', () => {
      const base = fixtureScore('res_base');
      const content = resumeContent();

      const once = rescore(base, content);

      expect(once.total).toBe(base.total);
      expect(once.summary).toBe(BASE_SUMMARY);
      expect(rescore(base, content)).toEqual(once);
      expect(rescore(once, content)).toEqual(once);
    });

    it('flips a missing keyword that has landed in skills and adds four points', () => {
      const base = fixtureScore('res_base');
      const content = resumeContent({
        skills: ['Figma', 'Design systems', 'Stakeholder management'],
      });

      const next = rescore(base, content);

      expect(itemById(base, 'kw_miss_0')?.passed).toBe(false);
      expect(itemById(next, 'kw_miss_0')?.passed).toBe(true);
      expect(itemById(next, 'kw_miss_1')?.passed).toBe(false);
      expect(next.total).toBe(base.total + 4);
      expect(next.summary).not.toBe(BASE_SUMMARY);
      expect(rescore(next, content)).toEqual(next);
    });

    it('passes the content gap once three bullets carry a number', () => {
      const base = fixtureScore('res_base');
      const content = resumeContent({
        experience: [
          {
            id: 'exp_1',
            company: 'Flipkart',
            title: 'Senior UX Designer',
            period: 'Mar 2022 — Present',
            bullets: [
              'Cut checkout drop-off by 12%.',
              'Shipped 40 components into the design system.',
              'Ran 18 usability sessions across 3 cities.',
            ],
          },
        ],
        links: ['https://georgesmith.design'],
      });

      const next = rescore(base, content);

      expect(itemById(next, 'content_gap')?.passed).toBe(true);
      expect(itemById(next, 'portfolio')?.passed).toBe(true);
      expect(next.total).toBe(base.total + 8);
      expect(rescore(next, content)).toEqual(next);
    });

    it('returns a cover letter score untouched', () => {
      const base = fixtureScore('res_base');

      expect(rescore(base, coverLetterContent)).toBe(base);
    });
  });
});
