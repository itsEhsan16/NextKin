import type { Education, Experience, ProfileDraft } from '@/data/models';
import {
  HEADLINE_KEY,
  acceptedDraft,
  addedSummary,
  importGroups,
  initialAccepted,
  isLowConfidenceEducation,
  isLowConfidenceExperience,
} from '@/features/create/importDraft';

const role = (over: Partial<Experience> = {}): Experience => ({
  id: 'exp_1',
  company: 'Northwind',
  title: 'Product Designer',
  startDate: '2022-03-01',
  endDate: '2024-06-01',
  current: false,
  skills: [],
  ...over,
});

const degree = (over: Partial<Education> = {}): Education => ({
  id: 'edu_1',
  institution: 'Manipal University',
  degree: 'B.Des',
  startDate: '2014-08-01',
  endDate: '2018-05-01',
  current: false,
  ...over,
});

const draftOf = (over: Partial<ProfileDraft> = {}): ProfileDraft => ({
  headline: 'Product Designer',
  skills: ['Figma', 'Prototyping'],
  experiences: [role()],
  education: [degree()],
  ...over,
});

describe('importDraft — the accepted-row model (V2 §7.4)', () => {
  describe('the low-confidence rule', () => {
    it('trusts a dated role and a role still running', () => {
      expect(isLowConfidenceExperience(role())).toBeUndefined();
      expect(
        isLowConfidenceExperience(role({ current: true, endDate: undefined })),
      ).toBeUndefined();
    });

    it('doubts a role with no end date and no "current" flag', () => {
      // A resume writes "2022 –" for a job someone still holds, and the parser cannot tell that
      // from a date it failed to read. Either way it is an assumption, not a reading.
      expect(isLowConfidenceExperience(role({ current: false, endDate: undefined }))).toBe(
        'No end date found',
      );
    });

    it('doubts a role missing the company or the title', () => {
      expect(isLowConfidenceExperience(role({ company: '  ' }))).toBe('Missing details');
      expect(isLowConfidenceExperience(role({ title: '' }))).toBe('Missing details');
    });

    it('applies the same rule to education', () => {
      expect(isLowConfidenceEducation(degree())).toBeUndefined();
      expect(isLowConfidenceEducation(degree({ current: false, endDate: undefined }))).toBe(
        'No end date found',
      );
      expect(isLowConfidenceEducation(degree({ institution: '' }))).toBe('Missing details');
    });
  });

  describe('importGroups', () => {
    it('has nothing to show for an absent draft', () => {
      expect(importGroups(null)).toEqual([]);
    });

    it('drops empty groups and captions each row', () => {
      const groups = importGroups({ skills: ['Figma'], experiences: [], education: [] });
      expect(groups.map((group) => group.key)).toEqual(['skills']);
      expect(groups[0]?.rows).toEqual([{ key: 'skill:0', title: 'Figma' }]);
    });

    it('lays the groups out headline → experience → education → skills', () => {
      const groups = importGroups(draftOf());
      expect(groups.map((group) => group.key)).toEqual([
        'headline',
        'experiences',
        'education',
        'skills',
      ]);
      expect(groups[1]?.rows[0]).toEqual({
        key: 'exp:exp_1',
        title: 'Product Designer',
        caption: 'Northwind · Mar 2022 – Jun 2024',
      });
    });

    it('says out loud what it could not read, rather than drawing a bare dash', () => {
      const groups = importGroups(
        draftOf({ experiences: [role({ current: false, endDate: undefined })] }),
      );
      const row = groups[1]?.rows[0];
      expect(row?.caption).toBe('Northwind · Mar 2022 – no end date found');
      expect(row?.warning).toBe('No end date found');
    });
  });

  describe('initialAccepted', () => {
    it('accepts everything the parse was sure about', () => {
      expect([...initialAccepted(draftOf())].sort()).toEqual([
        'edu:edu_1',
        'exp:exp_1',
        'headline',
        'skill:0',
        'skill:1',
      ]);
    });

    it('leaves a guessed row switched off', () => {
      const accepted = initialAccepted(
        draftOf({ experiences: [role({ current: false, endDate: undefined })] }),
      );
      expect(accepted.has('exp:exp_1')).toBe(false);
      expect(accepted.has('skill:0')).toBe(true);
    });
  });

  describe('acceptedDraft', () => {
    it('narrows the draft to the rows still switched on', () => {
      const draft = draftOf();
      const selection = acceptedDraft(draft, new Set(['skill:1', 'exp:exp_1']));

      expect(selection.skills).toEqual(['Prototyping']);
      expect(selection.experiences).toEqual([role()]);
      expect(selection.education).toEqual([]);
      // §7.4: an unaccepted headline is OMITTED rather than sent blank, so applying it cannot
      // overwrite the headline the profile already has.
      expect('headline' in selection).toBe(false);
    });

    it('carries the headline when it is accepted', () => {
      expect(acceptedDraft(draftOf(), new Set([HEADLINE_KEY])).headline).toBe('Product Designer');
    });

    it('sends nothing at all when every row is off', () => {
      const selection = acceptedDraft(draftOf(), new Set());
      expect(selection).toEqual({ skills: [], experiences: [], education: [], certifications: [] });
    });
  });

  describe('addedSummary — the count on screen BEFORE the press', () => {
    it('counts roles and skills', () => {
      expect(
        addedSummary({
          experiences: [role(), role({ id: 'exp_2' })],
          skills: Array(8).fill('Figma'),
        }),
      ).toBe('Adds 2 roles and 8 skills');
    });

    it('lists every kind it will add, in the order the page draws them', () => {
      expect(addedSummary(draftOf())).toBe('Adds a headline, 1 role, 1 degree and 2 skills');
    });

    it('has nothing to say when nothing is selected', () => {
      expect(addedSummary({ skills: [], experiences: [], education: [] })).toBeNull();
      expect(addedSummary({})).toBeNull();
    });
  });
});
