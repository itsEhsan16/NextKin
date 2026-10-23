import { describe, expect, it } from 'vitest';

import { isSkillName, repairText, splitSkills, titleOf, verify, type JdExtraction } from '../src/pipeline/stages/extractJd';

/** A skill list holds skills, not qualification lines, whatever the model returns (toreview §110). */

const RAW = `Qualifications
- Bachelor's degree in Computer Science or a related field
- 0-2 years of experience building web applications
- Strong JavaScript and TypeScript skills
Responsibilities
- Develop REST APIs in Node.js and Express and keep them fast and well tested`;

const item = (text: string, quote: string) => ({ text, quote });

describe('the skill lists', () => {
  it('keep named skills and drop degrees, years and sentences, counting them', () => {
    const extraction: JdExtraction = {
      title: null,
      company: null,
      location: null,
      experienceLevel: null,
      employmentType: null,
      domain: null,
      language: 'en',
      requiredSkills: [
        item("Bachelor's degree in Computer Science or a related field", "Bachelor's degree in Computer Science or a related field"),
        item('0-2 years of experience building web applications', '0-2 years of experience building web applications'),
        item('JavaScript', 'Strong JavaScript and TypeScript skills'),
        item('TypeScript', 'Strong JavaScript and TypeScript skills'),
      ],
      preferredSkills: [],
      tools: [item('Node.js', 'Develop REST APIs in Node.js and Express')],
      // A responsibility is a sentence; the skill rule does not apply to it.
      responsibilities: [item('Develop REST APIs in Node.js and Express and keep them fast and well tested', 'Develop REST APIs in Node.js and Express and keep them fast and well tested')],
      softSkills: [],
    };
    const jd = verify(RAW, extraction);
    expect(jd.requiredSkills).toEqual(['JavaScript', 'TypeScript']);
    expect(jd.tools).toEqual(['Node.js']);
    expect(jd.responsibilities).toHaveLength(1);
    expect(jd.stats.dropped).toBe(2);
  });

  it('splits a line that names two known skills, and only then', () => {
    expect(splitSkills('JavaScript and TypeScript')).toEqual(['JavaScript', 'TypeScript']);
    expect(splitSkills('Docker & Kubernetes')).toEqual(['Docker', 'Kubernetes']);
    expect(splitSkills('Research and development')).toEqual(['Research and development']);
    expect(splitSkills('CI/CD')).toEqual(['CI/CD']);
    const jd = verify('Strong JavaScript and TypeScript skills', { title: null, company: null, location: null, experienceLevel: null, employmentType: null, domain: null, language: 'en', requiredSkills: [item('JavaScript and TypeScript', 'Strong JavaScript and TypeScript skills')], preferredSkills: [], tools: [], responsibilities: [], softSkills: [] });
    expect(jd.requiredSkills).toEqual(['JavaScript', 'TypeScript']);
  });

  it('knows a skill name when it sees one', () => {
    for (const name of ['TypeScript', 'REST APIs', 'unit testing', 'CI/CD pipelines', 'Machine learning']) expect(isSkillName(name)).toBe(true);
    for (const name of ["Master's degree", '5+ years Java', 'Ability to work independently in a fast moving team environment']) expect(isSkillName(name)).toBe(false);
  });

  it('a category is not a skill: "backend technologies", a bare "APIs" (toreview §110.5)', () => {
    for (const name of ['backend technologies', 'APIs', 'modern frameworks', 'tools']) expect(isSkillName(name)).toBe(false);
    for (const name of ['REST APIs', 'NoSQL', 'version control', 'AWS']) expect(isSkillName(name)).toBe(true);
  });
});

describe('the title', () => {
  it('is the model’s when the text says it, dashes and case aside, else a labelled line, never a guess', () => {
    expect(titleOf('Front-End Developer – Muthoot Fincorp\nWe build…', 'Front End Developer')).toBe('Front End Developer');
    expect(titleOf('About us\nJob Title: Frontend Developer\nLocation: Kochi', 'Senior UI Wizard')).toBe('Frontend Developer');
    expect(titleOf('We are hiring someone great.', 'Product Manager')).toBeNull();
  });
});

describe('the stored text and the extra lists (toreview §112)', () => {
  it('turns a "?" between letters back into the hyphen the copy lost, and nothing else', () => {
    expect(repairText('Full?Stack, end?to?end and pixel?perfect. Why? Because 2?3 stays.')).toBe('Full-Stack, end-to-end and pixel-perfect. Why? Because 2?3 stays.');
  });

  it('keeps practices, standards and domain terms as skills, and soft skills apart, each quoted', () => {
    const raw = 'Implement accessible (WCAG) UI components. Customer onboarding & KYC journeys. Good communication and teamwork skills.';
    const none = { title: null, company: null, location: null, experienceLevel: null, employmentType: null, domain: null, language: 'en' as const, tools: [], responsibilities: [] };
    const jd = verify(raw, {
      ...none,
      requiredSkills: [item('WCAG', 'Implement accessible (WCAG) UI components')],
      preferredSkills: [item('KYC', 'Customer onboarding & KYC journeys'), item('Payments', 'Payments, transactions, and settlements')],
      softSkills: [item('communication', 'Good communication and teamwork skills'), item('teamwork', 'Good communication and teamwork skills')],
    });
    expect(jd.requiredSkills).toEqual(['WCAG']);
    expect(jd.preferredSkills).toEqual(['KYC']); // "Payments" is not quoted from this text
    expect(jd.softSkills).toEqual(['communication', 'teamwork']);
  });
});
