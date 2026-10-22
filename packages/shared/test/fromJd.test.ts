import { describe, expect, it } from 'vitest';

import { jobFromJd, qualificationLines, remoteFromText, yearsFromText } from '../src/jobs/fromJd';
import type { JdDraft } from '../src/models';

/** A job description shown as a job (toreview §110): only what it states. */

const RAW = `Junior Software Engineer

Northwind Energy is hiring a Junior Software Engineer to join our product team in Bengaluru (hybrid).

Responsibilities
- Build features in Angular

Qualifications
- Bachelor's degree in Computer Science
Strong JavaScript and TypeScript skills
- 0-2 years of experience building web applications

Nice to have
- Experience with Docker

Benefits
- Health insurance`;

const draft: JdDraft = {
  id: 'jd_1',
  source: 'paste',
  title: 'Junior Software Engineer',
  company: 'Northwind Energy',
  requiredSkills: ['Angular', 'TypeScript'],
  preferredSkills: ['Docker'],
  responsibilities: ['Build features in Angular'],
  tools: [],
  rawText: RAW,
  status: 'ready',
  createdAt: '2026-10-18T00:00:00.000Z',
};

describe('jobFromJd', () => {
  it('lists the required lines as written, and stops at nice-to-have', () => {
    expect(qualificationLines(RAW)).toEqual([
      "Bachelor's degree in Computer Science",
      'Strong JavaScript and TypeScript skills',
      '0-2 years of experience building web applications',
    ]);
    expect(qualificationLines('No headings here.\nJust prose.')).toEqual([]);
  });

  it('reads the work mode and a years range only when the text states them', () => {
    expect(remoteFromText(RAW)).toBe('hybrid');
    expect(remoteFromText('Work fully remote from anywhere')).toBe('remote');
    expect(remoteFromText('A great team')).toBeNull();
    expect(yearsFromText(RAW)).toEqual({ min: 0, max: 2 });
    expect(yearsFromText('5+ years')).toBeNull();
  });

  it('marks which facts the JD stated, so the page can leave out the defaults', () => {
    const { job, known } = jobFromJd(draft);
    expect(job).toMatchObject({
      id: 'jd_1',
      title: 'Junior Software Engineer',
      company: 'Northwind Energy',
      remote: 'hybrid',
      tags: ['Angular', 'TypeScript', 'Docker'],
      isSaved: false,
    });
    expect(job.description).toMatch(/^Northwind Energy is hiring/);
    expect(job.requirements).toHaveLength(3);
    expect(known).toEqual({
      company: true,
      location: false,
      remote: true,
      employmentType: false,
      experienceLevel: false,
      years: true,
    });
  });

  it('lists no requirements the text does not state: the skills are their own lists (toreview §110.5)', () => {
    const { job } = jobFromJd({ ...draft, rawText: 'Build things.' });
    expect(job.requirements).toEqual([]);
  });

  it('carries the match onto the job, and the link the JD came from as where to apply', () => {
    const { job } = jobFromJd(
      { ...draft, sourceUrl: 'https://boards.example.com/jobs/1' },
      {
        matchScore: 0.42,
        matchBand: 'fair',
        matchBasis: {
          kind: 'full',
          requiredMet: 1,
          requiredPartial: 0,
          requiredTotal: 2,
          preferredMet: 0,
          preferredTotal: 1,
          method: 'jobmatch-1',
        },
      },
    );
    expect(job).toMatchObject({
      matchScore: 0.42,
      matchBand: 'fair',
      applyUrl: 'https://boards.example.com/jobs/1',
      companyWebsite: 'boards.example.com',
    });
  });
});
