import type { ContentRole } from '@/data/models';
import {
  addBullet,
  addEntry,
  draftsEqual,
  moveEntry,
  newRole,
  removeAt,
  removeBullet,
  removeEntry,
  SUMMARY_MAX,
  validateSection,
  type SectionDraft,
} from '@/features/resumes/sectionEdits';

const role = (id: string): ContentRole => ({
  id,
  company: 'PhonePe',
  title: 'Senior Product Designer',
  period: 'Mar 2022 — Present',
  bullets: ['Cut onboarding from five days to two'],
});

describe('sectionEdits (V2 §7.11 / §7.10 — the section editor rules)', () => {
  describe('validateSection', () => {
    it('refuses a blank summary and a summary over the cap, and passes one in between', () => {
      const blank: SectionDraft = { section: 'summary', value: '   ' };
      const result = validateSection(blank);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.summary).toBeDefined();

      const tooLong: SectionDraft = { section: 'summary', value: 'x'.repeat(SUMMARY_MAX + 1) };
      const long = validateSection(tooLong);
      expect(long.ok).toBe(false);
      if (!long.ok) expect(long.errors.summary).toContain(String(SUMMARY_MAX));

      expect(validateSection({ section: 'summary', value: 'Eight years of design.' })).toEqual({
        ok: true,
      });
    });

    it('treats an empty list as valid — the add affordance is the empty state', () => {
      expect(validateSection({ section: 'skills', value: [] })).toEqual({ ok: true });
      expect(validateSection({ section: 'experience', value: [] })).toEqual({ ok: true });
    });

    it('names the field on a role that is missing its dates or a blank bullet', () => {
      const draft: SectionDraft = {
        section: 'experience',
        value: [{ ...role('role_1'), period: '', bullets: ['Shipped it', '  '] }],
      };
      const result = validateSection(draft);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors['role_1.period']).toBeDefined();
        expect(result.errors['role_1.bullet.1']).toBeDefined();
        expect(result.errors['role_1.bullet.0']).toBeUndefined();
        expect(result.errors['role_1.title']).toBeUndefined();
      }
    });

    it('asks a letter for a greeting, a sign-off and at least one paragraph', () => {
      const result = validateSection({
        section: 'letter',
        value: { greeting: '', paragraphs: ['', '   '], signoff: '' },
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(Object.keys(result.errors).sort()).toEqual(['greeting', 'paragraphs', 'signoff']);
      }
    });
  });

  describe('string lists', () => {
    it('refuses a duplicate case-insensitively rather than dropping it silently', () => {
      const entries = ['Figma', 'Design systems'];
      const dupe = addEntry(entries, '  figma ', 'skill');
      expect(dupe).toEqual({ refused: 'figma is already in this list.' });

      const empty = addEntry(entries, '   ', 'skill');
      expect(empty).toEqual({ refused: 'Type a skill first.' });

      expect(addEntry(entries, '  Prototyping ', 'skill')).toEqual({
        entries: ['Figma', 'Design systems', 'Prototyping'],
      });
    });

    it('removes by value', () => {
      expect(removeEntry(['Figma', 'Prototyping'], 'Figma')).toEqual(['Prototyping']);
    });
  });

  describe('bullets', () => {
    it('adds an empty bullet and removes one by index', () => {
      const withExtra = addBullet(role('role_1'));
      expect(withExtra.bullets).toEqual(['Cut onboarding from five days to two', '']);
      expect(removeBullet(withExtra, 0).bullets).toEqual(['']);
    });
  });

  describe('entry lists', () => {
    it('removes the last role, leaving an empty section rather than a hole', () => {
      const roles = [role('role_1')];
      expect(removeAt(roles, 0)).toEqual([]);
      // The original is untouched: every helper returns a new list.
      expect(roles).toHaveLength(1);
    });

    it('moves an entry and leaves an out-of-range move alone', () => {
      const roles = [role('a'), role('b'), role('c')];
      expect(moveEntry(roles, 2, 0).map((r) => r.id)).toEqual(['c', 'a', 'b']);
      expect(moveEntry(roles, 0, 9).map((r) => r.id)).toEqual(['a', 'b', 'c']);
    });

    it('gives a new role its own id and one empty bullet to fill in', () => {
      const first = newRole();
      const second = newRole();
      expect(first.id).not.toEqual(second.id);
      expect(first.bullets).toEqual(['']);
    });
  });

  describe('draftsEqual', () => {
    it('is true for an untouched copy and false once a bullet moves', () => {
      const draft: SectionDraft = { section: 'experience', value: [role('role_1')] };
      const copy: SectionDraft = { section: 'experience', value: [role('role_1')] };
      expect(draftsEqual(draft, copy)).toBe(true);
      expect(
        draftsEqual(draft, { section: 'experience', value: [addBullet(role('role_1'))] }),
      ).toBe(false);
    });
  });
});
