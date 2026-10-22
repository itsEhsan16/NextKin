import { describe, expect, it } from 'vitest';

import type { ResumeContent } from '../src/models/resumeContent';
import { resumeDiff, resumeTextView } from '../src/scoring/resumeDiff';

/** The highlighted lines of a tailored resume (toreview §113). Synthetic. */

const base: ResumeContent = {
  kind: 'resume',
  resumeId: 'r1',
  versionId: 'v1',
  headline: 'Developer Intern',
  summary: 'Builds web apps.',
  skills: ['React', 'SQL'],
  experience: [{ id: 'e1', roleId: 'web', company: 'Webcros', title: 'Developer Intern', period: '2025', bullets: ['Built a marketplace', 'Ran demos'] }],
  projects: [{ id: 'p1', name: 'LinkTrack', description: '', bullets: ['Built a dashboard'] }],
  certifications: [],
  education: [],
};

describe('resumeDiff', () => {
  it('lists only the sections that changed, new lines marked, new skills alone', () => {
    const next: ResumeContent = {
      ...base,
      versionId: 'v2',
      headline: 'Front End Developer',
      skills: ['React', 'SQL', 'Vue'],
      experience: [{ ...base.experience[0]!, bullets: ['Built a marketplace with user interfaces in React', 'Ran demos'] }],
    };
    expect(resumeDiff(base, next)).toEqual([
      { title: 'Headline', lines: [{ text: 'Front End Developer', isNew: true }] },
      { title: 'Skills added', lines: [{ text: 'Vue', isNew: true }] },
      {
        title: 'Developer Intern · Webcros',
        lines: [
          { text: 'Built a marketplace with user interfaces in React', isNew: true },
          { text: 'Ran demos', isNew: false },
        ],
      },
    ]);
  });

  it('is empty when nothing changed', () => {
    expect(resumeDiff(base, { ...base, versionId: 'v2' })).toEqual([]);
  });
});

describe('resumeTextView (toreview §121)', () => {
  it('shows every section, marks what changed, and reads skills as one line', () => {
    const next = { ...base, versionId: 'v2', summary: 'Builds web apps for fintech.', skills: ['React', 'SQL', 'Vue'] };
    const view = resumeTextView(base, next);
    expect(view.map((s) => [s.title, s.changed])).toEqual([
      ['Summary', true],
      ['Skills', true],
      ['Developer Intern · Webcros', false],
      ['LinkTrack', false],
    ]);
    expect(view[1]!.lines).toEqual([{ text: 'React, SQL, Vue', isNew: false }]);
  });

  it('marks nothing without a base to compare with', () => {
    expect(resumeTextView(undefined, base).some((s) => s.changed)).toBe(false);
  });
});
