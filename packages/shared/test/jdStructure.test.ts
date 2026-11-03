import { describe, expect, it } from 'vitest';

import { legacyFields } from '../src/jobs/jdLegacy';
import { haystackOf, locate } from '../src/jobs/jdLocate';
import { dateIn, daysPerWeekIn, parsePay, parseYears } from '../src/jobs/jdParse';
import { structureJd, type JdModelReading } from '../src/jobs/jdStructure';

/** The structured reading (toreview §153). Every posting here is synthetic. */

const empty: JdModelReading = {
  title: null,
  company: null,
  department: null,
  industry: null,
  employmentType: null,
  seniority: null,
  openings: null,
  referenceId: null,
  summary: null,
  locations: [],
  workModes: [],
  schedule: [],
  pay: [],
  negotiable: null,
  experience: [],
  responsibilities: [],
  skills: [],
  education: [],
  languages: [],
  benefits: [],
  eligibility: [],
  companyAbout: [],
  website: null,
  application: [],
  extras: [],
  issues: [],
};
const opts = { today: '2026-11-03' };

describe('pay, read from its line', () => {
  it.each([
    ['₹45,000 - ₹80,000 monthly', { min: 45000, max: 80000, currency: 'INR', period: 'month' }],
    [
      'Rs. 45,000 to 80,000 per month',
      { min: 45000, max: 80000, currency: 'INR', period: 'month' },
    ],
    ['4-6 LPA', { min: 400000, max: 600000, currency: 'INR', period: 'year' }],
    ['INR 4.5 lakh per annum', { min: 450000, max: 450000, currency: 'INR', period: 'year' }],
    ['$120k–$150k a year', { min: 120000, max: 150000, currency: 'USD', period: 'year' }],
    ['$30/hr', { min: 30, max: 30, currency: 'USD', period: 'hour' }],
    ['€70.000 – €85.000 per year', { min: 70000, max: 85000, currency: 'EUR', period: 'year' }],
  ])('%s', (line, want) => {
    expect(parsePay(line)).toEqual({ component: 'unknown', ...want });
  });

  it('a line with only a count is not pay', () => {
    expect(parsePay('5 working days')).toBeNull();
  });
});

describe('years, freshers, days and dates', () => {
  it.each([
    ['Min. 1 year', { min: 1 }],
    ['1-3 years of experience', { min: 1, max: 3 }],
    ['5+ yrs in backend', { min: 5 }],
    ['at least two years', { min: 2 }],
    ['Freshers can apply', { freshersOk: true }],
  ])('%s', (line, want) => {
    expect(parseYears(line)).toEqual(want);
  });
  it('reads working days and dates', () => {
    expect(daysPerWeekIn('5 days working')).toBe(5);
    expect(daysPerWeekIn('Five working days')).toBe(5);
    expect(dateIn('Apply by 31 Dec 2026')).toBe('2026-12-31');
    expect(dateIn('Closes December 1, 2026')).toBe('2026-12-01');
  });
});

describe('quotes keep their place in the text', () => {
  it('maps a folded match back to the original offsets', () => {
    const raw = 'Role:\n  Build “secure”   REST APIs – fast.';
    const q = locate(haystackOf(raw), 'build "secure" rest apis - fast');
    expect(q).not.toBeNull();
    expect(raw.slice(q!.start, q!.end)).toBe('Build “secure”   REST APIs – fast');
  });
});

describe('structureJd', () => {
  it('keeps overlapping pay lines, shows one range and flags how they relate', () => {
    const raw =
      'Salary ₹45,000 - ₹80,000 monthly. Fixed ₹45,000 - ₹80,000. Earning Potential ₹80,000.';
    const s = structureJd(
      raw,
      {
        ...empty,
        pay: [
          { component: 'unknown', quote: '₹45,000 - ₹80,000 monthly' },
          { component: 'fixed', quote: 'Fixed ₹45,000 - ₹80,000' },
          { component: 'total', quote: 'Earning Potential ₹80,000' },
        ],
      },
      opts,
    );
    expect(s.compensation.statements).toHaveLength(2);
    expect(s.compensation.range?.value).toMatchObject({
      min: 45000,
      max: 80000,
      period: 'month',
      component: 'fixed',
    });
    expect(s.compensation.range?.status).toBe('unclear');
    expect(s.issues.map((i) => i.field)).toContain('compensation');
  });

  it('says five working days once, with every place it was said', () => {
    const raw =
      'Five working days. Benefits: 5 working days, health insurance. We work 5 days working.';
    const s = structureJd(
      raw,
      {
        ...empty,
        schedule: [
          { kind: 'days', text: 'Five working days', quote: 'Five working days' },
          { kind: 'days', text: '5 days working', quote: '5 days working' },
        ],
        benefits: [
          { text: '5 working days', quote: '5 working days' },
          { text: 'Health insurance', quote: 'health insurance' },
        ],
      },
      opts,
    );
    expect(s.schedule).toHaveLength(1);
    expect(s.schedule[0]).toMatchObject({ daysPerWeek: 5 });
    expect(s.schedule[0]!.quotes).toHaveLength(3);
    expect(s.benefits.map((b) => b.value)).toEqual(['Health insurance']);
  });

  it('flags a minimum of a year beside "freshers can apply" and keeps both', () => {
    const raw = 'Minimum 1 year experience. Freshers can apply.';
    const s = structureJd(
      raw,
      {
        ...empty,
        experience: [
          { text: 'Minimum 1 year experience', quote: 'Minimum 1 year experience' },
          { text: 'Freshers can apply', quote: 'Freshers can apply' },
        ],
      },
      opts,
    );
    expect(s.experience.minYears?.value).toBe(1);
    expect(s.experience.freshersOk?.value).toBe(true);
    expect(s.issues.find((i) => i.kind === 'conflict')?.note).toMatch(/freshers can apply/);
  });

  it('drops what the text does not say, and never fills a missing field', () => {
    const raw = 'We need React and Node.js developers.';
    const s = structureJd(
      raw,
      {
        ...empty,
        title: { text: 'Senior Engineer', quote: 'Senior Engineer' },
        skills: [
          {
            name: 'React',
            quote: 'React and Node.js',
            category: 'framework',
            importance: 'required',
          },
          { name: 'Kubernetes', quote: 'Kubernetes', category: 'tool', importance: 'required' },
        ],
      },
      opts,
    );
    expect(s.identity.title).toBeUndefined();
    expect(s.skills.map((k) => k.value)).toEqual(['React']);
    expect(s.stats.dropped).toBe(2);
    expect(s.compensation.range).toBeUndefined();
  });

  it('flags remote beside on-site, sensitive conditions, and a closing date that has passed', () => {
    const raw =
      'Fully remote role. Work from office in Pune. Age 18-40 years. Apply by 1 Oct 2026.';
    const s = structureJd(
      raw,
      {
        ...empty,
        workModes: [
          { value: 'remote', quote: 'Fully remote role' },
          { value: 'onsite', quote: 'Work from office in Pune' },
        ],
        eligibility: [
          { kind: 'age', text: 'Age 18-40 years', quote: 'Age 18-40 years', sensitive: false },
        ],
        application: [
          { kind: 'deadline', text: 'Apply by 1 Oct 2026', quote: 'Apply by 1 Oct 2026' },
        ],
      },
      opts,
    );
    expect(s.workMode?.status).toBe('unclear');
    expect(s.eligibility[0]?.sensitive).toBe(true);
    expect(s.issues.map((i) => i.kind).sort()).toEqual(['conflict', 'expired', 'sensitive']);
  });

  it('keeps a model-reported issue only when its quotes are real', () => {
    const raw = 'Title: Data Analyst. Later: Senior Data Scientist role.';
    const s = structureJd(
      raw,
      {
        ...empty,
        issues: [
          {
            kind: 'conflict',
            field: 'title',
            note: 'Two titles',
            quotes: ['Data Analyst', 'Senior Data Scientist'],
          },
          { kind: 'conflict', field: 'title', note: 'Made up', quotes: ['Chief Wizard'] },
        ],
      },
      opts,
    );
    expect(s.issues).toHaveLength(1);
    expect(s.issues[0]?.by).toBe('model');
  });

  it('derives the flat lists every consumer reads', () => {
    const raw = 'Must know React. Nice to have: AWS. Good communication.';
    const s = structureJd(
      raw,
      {
        ...empty,
        skills: [
          {
            name: 'React',
            quote: 'Must know React',
            category: 'framework',
            importance: 'required',
          },
          { name: 'AWS', quote: 'Nice to have: AWS', category: 'cloud', importance: 'preferred' },
          {
            name: 'communication',
            quote: 'Good communication',
            category: 'soft',
            importance: 'required',
          },
        ],
      },
      opts,
    );
    expect(legacyFields(s)).toMatchObject({
      requiredSkills: ['React'],
      preferredSkills: ['AWS'],
      softSkills: ['communication'],
      tools: [],
    });
  });
});
