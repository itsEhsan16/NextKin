import { describe, expect, it } from 'vitest';

import { statedOf, statedYearsOf } from '../src/jobs/jdRequirements';
import { structureJd, type JdModelReading } from '../src/jobs/jdStructure';
import { jdLists, requirementsOf } from '../src/scoring/adapters';

/**
 * The structured reading as the ledger's source (toreview §206.2). The posting is synthetic.
 */

const RAW = `Backend Engineer — Kestrel Freight
3-5 years of backend experience.
- 3+ years of Python in production
- SQL, with 2 years of PostgreSQL
- 5 years in logistics, some Kafka
- 4 years of Java and Spring Boot
Bachelor's degree in Computer Science or similar.
AWS Certified Developer is a plus.
Fluent German is required.
You must have the right to work in Germany.
Applicants must be under 30 years of age.
You have closed deals before.`;

const reading: JdModelReading = {
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
  experience: [{ text: '3-5 years of backend experience', quote: '3-5 years of backend experience.' }],
  responsibilities: [],
  skills: [
    { name: 'Python', quote: '3+ years of Python in production', category: 'language', importance: 'required' },
    { name: 'SQL', quote: 'SQL, with 2 years of PostgreSQL', category: 'database', importance: 'required' },
    { name: 'PostgreSQL', quote: 'SQL, with 2 years of PostgreSQL', category: 'database', importance: 'required' },
    { name: 'Kafka', quote: '5 years in logistics, some Kafka', category: 'tool', importance: 'preferred' },
    { name: 'logistics', quote: '5 years in logistics, some Kafka', category: 'domain', importance: 'required' },
    { name: 'Java', quote: '4 years of Java and Spring Boot', category: 'language', importance: 'required' },
    { name: 'Spring Boot', quote: '4 years of Java and Spring Boot', category: 'framework', importance: 'required' },
  ],
  education: [
    { text: "Bachelor's degree in Computer Science", quote: "Bachelor's degree in Computer Science or similar.", importance: 'required' },
    { text: 'AWS Certified Developer', quote: 'AWS Certified Developer is a plus.', importance: 'preferred' },
  ],
  languages: [{ name: 'German', quote: 'Fluent German is required.', importance: 'required', level: 'fluent' }],
  benefits: [],
  eligibility: [
    { text: 'Right to work in Germany', quote: 'You must have the right to work in Germany.', kind: 'work_authorization', sensitive: false },
    { text: 'Under 30', quote: 'Applicants must be under 30 years of age.', kind: 'age', sensitive: true },
  ],
  companyAbout: [],
  website: null,
  application: [],
  extras: [],
  issues: [],
};

const structured = structureJd(RAW, reading, { today: '2026-11-15' });

describe('what a structured reading states, for the ledger', () => {
  it('ties years to the skill its own line names, number first', () => {
    const { skillYears } = statedOf(structured);
    expect(skillYears).toEqual({ Python: 3, PostgreSQL: 2, logistics: 5, Java: 4, 'Spring Boot': 4 });
  });

  it('turns degrees, certificates, languages and conditions into reported lines, each with its words', () => {
    const { eligibility } = statedOf(structured);
    expect(eligibility?.map((e) => [e.kind, e.importance, e.text])).toEqual([
      ['education', 'required', "Bachelor's degree in Computer Science or similar."],
      ['certification', 'preferred', 'AWS Certified Developer is a plus.'],
      ['language', 'required', 'Fluent German is required.'],
      ['work_authorization', undefined, 'You must have the right to work in Germany.'],
    ]);
    const degree = eligibility![0]!;
    expect(RAW.slice(degree.span!.start, degree.span!.end)).toBe(degree.text);
  });

  it('never asks the candidate to "meet" a condition on age or gender', () => {
    expect(statedOf(structured).eligibility?.some((e) => /under 30/i.test(e.text))).toBe(false);
  });

  it('reads the years the posting asks overall', () => {
    expect(statedYearsOf(structured)).toEqual({ min: 3, max: 5 });
    expect(statedYearsOf(structureJd(RAW, { ...reading, experience: [] }, { today: '2026-11-15' }))).toBeUndefined();
  });

  it('reaches the requirement ledger through the JD’s lists', () => {
    const draft = { requiredSkills: ['Python', 'SQL', 'PostgreSQL'], preferredSkills: ['Kafka'], tools: [], rawText: RAW, structured };
    const reqs = requirementsOf(jdLists(draft));
    expect(reqs.find((r) => r.id === 'req:python')?.minYears).toBe(3);
    expect(reqs.find((r) => r.id === 'req:postgresql')?.minYears).toBe(2);
    expect(reqs.find((r) => r.id === 'req:sql')?.minYears).toBeUndefined();
    expect(reqs.filter((r) => r.kind === 'eligibility').map((r) => r.id)).toEqual(['elig:education', 'elig:certification', 'elig:language', 'elig:work_authorization']);
    // Without the reading, only what the phrase search knows is reported.
    const plain = requirementsOf(jdLists({ ...draft, structured: undefined }));
    expect(plain.some((r) => r.id === 'elig:education')).toBe(false);
  });
});
