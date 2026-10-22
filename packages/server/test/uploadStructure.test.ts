import { canonicalResumeSchema } from '@nextkin/shared/schemas/resumeContent';
import { describe, expect, it } from 'vitest';

import { crossCheck } from '../src/parsing/extract';
import { splitHeader } from '../src/parsing/header';
import { EXTRACTION, LINKS, TEXT } from './fixtures/structuredResume';

/**
 * An uploaded resume keeps its own structure (toreview §111): the header read by code and never
 * sent to the model, a role's client projects, the skills' labelled lines, extra sections, the
 * order and wording of the headings — and each line kept in one place only. Synthetic (L4).
 */

describe('the header', () => {
  it('is read by code: the name, each contact item in order, and the links they carry', () => {
    const { header, body } = splitHeader(TEXT, LINKS);
    expect(header).toEqual({
      name: 'Alex Rivera',
      items: [
        { text: 'Pune, India' },
        { text: '+91 98470 12345', url: 'tel:+919847012345' },
        { text: 'alex.rivera@example.com', url: 'mailto:alex.rivera@example.com' },
        { text: 'LinkedIn', url: 'https://www.linkedin.com/in/alex-rivera' },
        { text: 'GitHub', url: 'https://github.com/alexrivera' },
      ],
    });
    // What the model reads starts at the first heading: no name, email, phone or link.
    expect(body.startsWith('Summary')).toBe(true);
    expect(body).not.toMatch(/Alex Rivera|example\.com|98470/);
  });

  it('is left alone when the top of the file is not a header', () => {
    expect(splitHeader('Summary\nBuilds things.').header).toBeUndefined();
  });
});

describe('the structure', () => {
  const { document, rejected } = crossCheck(EXTRACTION, TEXT);

  it('round-trips the schema', () => {
    expect(canonicalResumeSchema.parse(document)).toEqual(document);
  });

  it('keeps a role’s client projects as groups of its bullets', () => {
    const role = document.roles[0]!;
    expect(role.bullets.map((b) => b.text)).toEqual(['Built the booking flow in Next.js for customers and admins.', 'Designed the PostgreSQL schema for orders.', 'Built role-based flows for drivers.']);
    expect(role.entries).toEqual([
      { title: 'Ease Home - Home Services Platform', tech: 'Next.js, PostgreSQL', bulletIds: [role.bullets[0]!.id, role.bullets[1]!.id] },
      { title: 'MiTow - Roadside Assistance', tech: 'Next.js', bulletIds: [role.bullets[2]!.id] },
    ]);
  });

  it('keeps each line in one place: a client project is not filed again as a project', () => {
    expect(document.projects.map((p) => p.name)).toEqual(['LinkTrack - Link Analytics']);
    expect(document.projects[0]).toMatchObject({ tech: 'React, SQL', start: '2025-06', end: '2025-09' });
    expect(document.projects[0]!.bullets.map((b) => b.text)).toEqual(['Built a real-time click dashboard in React.']);
    expect(rejected.map((r) => r.reason)).toContain('This line is already kept in another section.');
  });

  it('keeps the skill lines, the school’s GPA and place, extra sections and the order', () => {
    expect(document.skillGroups).toEqual([{ label: 'Front End', names: ['React', 'TypeScript', 'HTML'] }, { label: 'Databases', names: ['PostgreSQL'] }]);
    expect(document.education[0]).toMatchObject({ gpa: 'GPA: 8.1 / 10', location: 'Kochi, India' });
    expect(document.sections?.map((s) => [s.heading, s.entries.length, s.lines.length])).toEqual([['Extracurricular', 1, 0], ['Certifications', 0, 1]]);
    expect(document.layout?.order).toEqual(['summary', 'skills', 'experience', 'projects', 'education', 'x:s0', 'x:s1']);
    expect(document.layout?.headings.skills).toBe('Technical Skills');
  });
});
