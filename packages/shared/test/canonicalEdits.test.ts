import { describe, expect, it } from 'vitest';

import { zeroProgress } from '../src/models/zeroResume';
import { contentNeedsReview } from '../src/models/resumeContent';
import { toResumeContent } from '../src/scoring/canonical';
import { applySection, applySkillFix, applyZeroAnswer, CanonicalEditError } from '../src/scoring/canonicalEdits';
import { canonicalResumeSchema, type CanonicalResumeJson } from '../src/schemas/resumeContent';

/** P10-02/P10-10: edits on the canonical resume keep every claim's evidence unless the user changed it. */

const DOC: CanonicalResumeJson = {
  schemaVersion: 1,
  headline: 'Backend Engineer',
  summary: { id: 's', text: 'Builds payment systems.', evidence: ['profile#summary'], origin: 'generated' },
  skills: [
    { id: 'k0', name: 'Go', evidence: ['r1'], origin: 'generated' },
    { id: 'k1', name: 'PostgreSQL', evidence: ['r1'], origin: 'generated' },
  ],
  roles: [
    {
      roleId: 'r1',
      company: 'Acme Pay',
      title: 'Senior Engineer',
      start: '2021-03',
      end: null,
      skills: ['Go'],
      bullets: [
        { id: 'b0', text: 'Cut settlement from 3 days to 4 hours.', evidence: ['r1#r0'], origin: 'generated' },
        { id: 'b1', text: 'Led the ledger rewrite.', evidence: ['r1#r1'], origin: 'generated' },
      ],
    },
  ],
  education: [{ factId: 'e1', institution: 'TU Berlin', degree: 'BSc', field: 'Computer Science', start: '2014', end: '2018' }],
  certifications: [],
  projects: [],
};

const ZERO: CanonicalResumeJson = {
  schemaVersion: 1,
  summary: { id: 's', text: 'Analyst with [N] years.', evidence: [], origin: 'assumed' },
  skills: [
    { id: 'k0', name: 'Excel', evidence: [], origin: 'assumed' },
    { id: 'k1', name: 'SQL', evidence: [], origin: 'assumed' },
  ],
  roles: [{ roleId: 'assumed-r0', company: '[Company Name]', title: 'Analyst', start: '2022', end: null, skills: [], bullets: [{ id: 'b0-0', text: 'Built [N] reports.', evidence: [], origin: 'assumed' }], assumed: true }],
  education: [{ factId: 'assumed-e0', institution: '[Institution Name]', degree: 'BA', assumed: true }],
  certifications: [],
  projects: [],
  review: { total: 5, roles: 1, education: 1, skills: ['Excel', 'SQL'], removedSkills: [] },
};

const editor = (doc: CanonicalResumeJson) => toResumeContent(doc, { resumeId: 'res', versionId: 'v' });

describe('applySection', () => {
  it('keeps the claims of lines left alone, and makes a changed or new line the user’s', () => {
    const role = editor(DOC).experience[0]!;
    const next = applySection(DOC, 'experience', [{ ...role, bullets: ['Cut settlement from 3 days to 4 hours.', 'Mentored four engineers.'] }]);
    const [kept, typed] = next.roles[0]!.bullets;
    expect(kept).toEqual(DOC.roles[0]!.bullets[0]);
    expect(typed).toMatchObject({ text: 'Mentored four engineers.', origin: 'user', evidence: [] });
    expect(next.roles[0]).toMatchObject({ roleId: 'r1', company: 'Acme Pay', start: '2021-03', end: null });
    expect(canonicalResumeSchema.safeParse(next).success).toBe(true);
  });

  it('reads an edited period back into structured dates, and keeps the old ones when unreadable', () => {
    const role = editor(DOC).experience[0]!;
    const { start: _s, end: _e, ...noDates } = role;
    expect(applySection(DOC, 'experience', [{ ...noDates, period: 'Jun 2020 — Present' }]).roles[0]).toMatchObject({ start: '2020-06', end: null });
    expect(applySection(DOC, 'experience', [{ ...noDates, period: 'sometime' }]).roles[0]).toMatchObject({ start: '2021-03', end: null });
  });

  it('a skills list keeps known skills’ evidence and adds the rest as the user’s', () => {
    const next = applySection(DOC, 'skills', ['postgresql', 'Kafka']);
    expect(next.skills[0]).toMatchObject({ id: 'k1', name: 'postgresql', evidence: ['r1'], origin: 'generated' });
    expect(next.skills[1]).toMatchObject({ name: 'Kafka', origin: 'user', evidence: [] });
    expect(new Set(next.skills.map((s) => s.id)).size).toBe(2);
  });

  it('an unchanged summary keeps its claim; an emptied one is removed', () => {
    expect(applySection(DOC, 'summary', 'Builds payment systems.').summary).toEqual(DOC.summary);
    expect(applySection(DOC, 'summary', '  ').summary).toBeUndefined();
    expect(applySection(DOC, 'summary', 'New words.').summary).toMatchObject({ id: 's', origin: 'user' });
  });

  it('saving a Zero Resume section by hand confirms what it assumed there (§7.9)', () => {
    const content = editor(ZERO);
    expect(contentNeedsReview(content)).toBe(true);
    const next = applySection(ZERO, 'experience', [{ ...content.experience[0]!, company: 'Northwind' }]);
    expect(next.roles[0]!.assumed).toBeUndefined();
    expect(next.roles[0]!.bullets[0]!.origin).toBe('user');
    const skills = applySection(ZERO, 'skills', ['Excel']);
    expect(skills.skills).toEqual([{ id: 'k0', name: 'Excel', evidence: [], origin: 'user' }]);
    expect(skills.review!.removedSkills).toEqual(['SQL']);
  });
});

describe('applyZeroAnswer', () => {
  it('walks the review to the end: edit a role, confirm a skill, delete a skill, fill education', () => {
    let doc = applyZeroAnswer(ZERO, { kind: 'role', roleId: 'assumed-r0', title: 'Data Analyst', company: 'Northwind', start: { year: 2022, month: 4 }, end: 'present' });
    expect(doc.roles[0]).toMatchObject({ title: 'Data Analyst', company: 'Northwind', start: '2022-04', end: null });
    doc = applyZeroAnswer(doc, { kind: 'skill', skill: 'Excel', name: 'Excel' });
    doc = applyZeroAnswer(doc, { kind: 'skill', skill: 'SQL', remove: true });
    expect(zeroProgress(editor(doc)).left).toBe(1);
    doc = applyZeroAnswer(doc, { kind: 'education', entryId: 'assumed-e0', degree: 'BA Economics', institution: 'University of Leeds', start: { year: 2016 }, end: { year: 2019 } });
    const content = editor(doc);
    expect(zeroProgress(content)).toEqual({ checked: 5, total: 5, left: 0 });
    expect(content.review!.removedSkills).toEqual(['SQL']);
  });

  it('refuses a blank, verbatim (ZERO_BLANK), and an id that is not on the draft', () => {
    expect(() => applyZeroAnswer(ZERO, { kind: 'role', roleId: 'assumed-r0', title: 'Analyst', company: '[Company Name]', start: { year: 2022 }, end: 'present' })).toThrow(CanonicalEditError);
    try {
      applyZeroAnswer(ZERO, { kind: 'education', entryId: 'assumed-e0', degree: '', institution: 'Leeds', start: { year: 2016 }, end: 'present' });
    } catch (error) {
      expect(error).toMatchObject({ code: 'ZERO_BLANK', message: "Add the real degree — a blank can't stay." });
    }
    expect(() => applyZeroAnswer(ZERO, { kind: 'role', roleId: 'nope', remove: true })).toThrow(/not on this draft/);
    expect(() => applyZeroAnswer(DOC, { kind: 'skill', skill: 'Go', remove: true })).toThrow(/no Zero Resume review/);
  });
});

describe('applySkillFix', () => {
  it('adds a backed skill to its role, or to the list; a gap never applies (C-10)', () => {
    const fix = { id: 'f1', type: 'surface_backed_skill' as const, label: 'Show Kafka', impact: 2, insertable: true, skill: 'Kafka', roleId: 'r1' };
    expect(applySkillFix(DOC, fix).roles[0]!.skills).toEqual(['Go', 'Kafka']);
    expect(applySkillFix(DOC, { ...fix, roleId: undefined }).skills.at(-1)).toMatchObject({ name: 'Kafka', origin: 'user' });
    expect(() => applySkillFix(DOC, { ...fix, type: 'gap', insertable: false })).toThrow(CanonicalEditError);
  });
});
