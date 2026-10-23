import { describe, expect, it } from 'vitest';

import { latexResumeOf } from '../src/export/latex/fromCanonical';
import { texOf } from '../src/export/latex/jakeTemplate';
import { lintTex } from '../src/export/latex/texLint';
import { crossCheck } from '../src/parsing/extract';
import { splitHeader } from '../src/parsing/header';
import { EXTRACTION, LINKS, TEXT } from './fixtures/structuredResume';

/**
 * A stored resume as the LaTeX template sets it (toreview §111): the file's own header, its
 * headings in its order and wording, a role's client projects nested under it, the skills' own
 * lines — and nothing the document does not hold. Synthetic (L4).
 */

const { header, body } = splitHeader(TEXT, LINKS);
const { document } = crossCheck(EXTRACTION, body);
const uploaded = { ...document, ...(header ? { header } : {}) };
const account = { name: 'Account Name', email: 'account@example.com' };

describe('latexResumeOf', () => {
  const resume = latexResumeOf(uploaded, account);

  it('prints the file’s header, not the account’s', () => {
    expect(resume.name).toBe('Alex Rivera');
    expect(resume.contact.map((c) => c.text)).toEqual(['Pune, India', '+91 98470 12345', 'alex.rivera@example.com', 'LinkedIn', 'GitHub']);
    expect(resume.contact[3]?.url).toBe('https://www.linkedin.com/in/alex-rivera');
  });

  it('keeps the file’s headings in its order and wording', () => {
    expect(resume.sections.map((s) => s.heading)).toEqual(['Summary', 'Technical Skills', 'Experience', 'Projects', 'Education', 'Extracurricular', 'Certifications']);
  });

  it('nests a role’s client projects under it, with their stack inline', () => {
    const experience = resume.sections.find((s) => s.heading === 'Experience');
    expect(experience?.kind).toBe('entries');
    const role = experience?.kind === 'entries' ? experience.entries[0] : undefined;
    expect(role).toMatchObject({ title: 'Brightleaf (brightleaf.dev)', subtitle: 'Full-Stack Developer', right: 'Nov 2023 – Present', bullets: [] });
    expect(role?.children?.map((c) => [c.title, c.tech, c.bullets.length])).toEqual([
      ['Ease Home - Home Services Platform', 'Next.js, PostgreSQL', 2],
      ['MiTow - Roadside Assistance', 'Next.js', 1],
    ]);
  });

  it('sets the skills as the file’s labelled lines', () => {
    const skills = resume.sections.find((s) => s.heading === 'Technical Skills');
    expect(skills).toEqual({ kind: 'lines', heading: 'Technical Skills', lines: [{ label: 'Front End', text: 'React, TypeScript, HTML' }, { label: 'Databases', text: 'PostgreSQL' }] });
  });

  it('never invents an end date: a dated project shows its own range', () => {
    const projects = resume.sections.find((s) => s.heading === 'Projects');
    const entry = projects?.kind === 'entries' ? projects.entries[0] : undefined;
    expect(entry).toMatchObject({ title: 'LinkTrack - Link Analytics', tech: 'React, SQL', right: 'Jun 2025 – Sep 2025' });
    const school = resume.sections.find((s) => s.heading === 'Education');
    expect(school?.kind === 'entries' ? school.entries[0] : undefined).toMatchObject({ subtitle: 'BTech, Computer Science, GPA: 8.1 / 10', subRight: 'Kochi, India' });
  });

  it('falls back to the account and the standard order when the file had no header or layout', () => {
    const plain = latexResumeOf({ ...document, layout: undefined, sections: undefined, skillGroups: undefined }, account);
    expect(plain.name).toBe('Account Name');
    expect(plain.contact).toEqual([{ text: 'account@example.com', url: 'mailto:account@example.com' }]);
    expect(plain.sections.map((s) => s.heading)).toEqual(['Summary', 'Skills', 'Experience', 'Projects', 'Education']);
  });

  it('produces TeX the lint accepts', () => {
    for (const density of [0, 1, 2] as const) expect(lintTex(texOf(latexResumeOf(uploaded, account, { density }))).problems).toEqual([]);
  });
});
