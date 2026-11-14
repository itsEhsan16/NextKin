import type { CanonicalResumeJson } from '@nextkin/shared/schemas/resumeContent';
import { describe, expect, it } from 'vitest';

import { planImport, readResumeForProfile, skillsNamedIn } from '../src/services/resumeSync';

const claim = (id: string, text: string, origin: 'user' | 'assumed' = 'user') => ({ id, text, evidence: [], origin });
const skill = (name: string, origin: 'user' | 'assumed' = 'user') => ({ id: name, name, evidence: [], origin });

const doc: CanonicalResumeJson = {
  schemaVersion: 1,
  summary: claim('s', 'Full-stack engineer who ships web products end to end.'),
  skills: [skill('React'), skill('Node.js'), skill('PostgreSQL'), skill('Go'), skill('Kubernetes', 'assumed')],
  roles: [
    {
      roleId: 'r1',
      company: 'Acme',
      title: 'Software Engineer',
      start: '2022-01',
      end: null,
      location: 'Bengaluru, India',
      skills: [],
      bullets: [claim('b1', 'Built the checkout in React and Node.js, cutting drop-off 18%.'), claim('b2', 'Let us go live in 3 weeks.')],
    },
    {
      roleId: 'r2',
      company: 'Globex',
      title: 'Intern',
      start: '2021-06',
      end: '2021-12',
      skills: ['PostgreSQL'],
      bullets: [claim('b3', 'Wrote reporting queries.')],
    },
    { roleId: 'r3', company: '[Company]', title: 'Guess', start: '2020-01', end: '2020-06', skills: [], bullets: [], assumed: true },
  ],
  education: [{ factId: 'e1', institution: 'IIT Delhi', degree: 'B.Tech', field: 'Computer Science', start: '2017', end: '2021' }],
  certifications: [{ factId: 'c1', name: 'AWS Certified Developer' }],
  projects: [{ factId: 'p1', name: 'Desi Etsy', description: 'A marketplace for artisans.', tech: 'Next.js, Stripe', bullets: [claim('pb', 'Listing and ordering flows.')] }],
  header: {
    name: 'Ana Rao',
    items: [
      { text: 'Bengaluru, India' },
      { text: '+91 98765 43210', url: 'tel:+919876543210' },
      { text: 'ana@example.com', url: 'mailto:ana@example.com' },
      { text: 'LinkedIn', url: 'https://www.linkedin.com/in/ana' },
      { text: 'github.com/ana' },
    ],
  },
};

const empty = { headline: null, bio: null, phone: null, location: null, years: null, links: [], skills: [], roles: [], education: [], certifications: [], projects: [] };

describe('readResumeForProfile', () => {
  const read = readResumeForProfile(doc, new Date('2024-01-15T00:00:00Z'));

  it('reads the header: phone and place, links by kind, never the email', () => {
    expect(read.phone).toBe('+91 98765 43210');
    expect(read.location).toBe('Bengaluru, India');
    expect(read.links.map((l) => [l.kind, l.url])).toEqual([
      ['linkedin', 'https://www.linkedin.com/in/ana'],
      ['github', 'https://github.com/ana'],
    ]);
  });

  it('keeps the person’s own facts and leaves out what Zero Resume assumed', () => {
    expect(read.skills).toContain('React');
    expect(read.skills).not.toContain('Kubernetes');
    expect(read.skills).toEqual(expect.arrayContaining(['Next.js', 'Stripe']));
    expect(read.roles.map((r) => r.company)).toEqual(['Acme', 'Globex']);
  });

  it('keeps every bullet and tags each role with the skills its own lines name', () => {
    const acme = read.roles[0]!;
    expect(acme.highlights).toHaveLength(2);
    expect(acme.skills).toEqual(expect.arrayContaining(['React', 'Node.js']));
    // "go live" is not the language Go.
    expect(acme.skills).not.toContain('Go');
    expect(acme.end).toBeNull();
    expect(read.roles[1]!.skills).toEqual(['PostgreSQL']);
  });

  it('fills the headline from the latest role, the bio from the summary, and counts years without double counting', () => {
    expect(read.headline).toBe('Software Engineer');
    expect(read.bio).toMatch(/^Full-stack/);
    // Jun 2021 – Jan 2024, overlaps merged: 2 whole years.
    expect(read.years).toBe(2);
  });

  it('keeps a project’s stack and bullets in its description', () => {
    expect(read.projects[0]!.description).toContain('Built with Next.js, Stripe');
    expect(read.projects[0]!.description).toContain('• Listing and ordering flows.');
  });
});

describe('planImport', () => {
  const read = readResumeForProfile(doc, new Date('2024-01-15T00:00:00Z'));

  it('fills an empty profile with everything', () => {
    const plan = planImport(empty, read);
    expect(plan.changes).toMatchObject({ roles: 2, education: 1, skills: read.skills.length, certifications: 1, projects: 1, links: 2, updates: 0 });
    expect(plan.changes.fields).toEqual(['headline', 'summary', 'phone', 'location', 'years']);
  });

  it('never overwrites what the person typed, and fills only blanks on rows it matches', () => {
    const plan = planImport(
      {
        ...empty,
        headline: 'Staff engineer',
        skills: ['react', 'NodeJS'],
        links: ['https://linkedin.com/in/ana/'],
        roles: [{ id: 'x', company: 'ACME', title: 'Software engineer', start: '2022-01-01', location: null, responsibilities: [], skills: ['React'] }],
        // Onboarding's "B.Tech CSE, 2021" is the same degree.
        education: [{ id: 'y', institution: 'B.Tech CSE', degree: 'B.Tech CSE', field: null, start: null, end: '2021-12-31' }],
      },
      read,
    );
    expect(plan.fields.headline).toBeUndefined();
    expect(plan.skills).not.toContain('React');
    expect(plan.skills).not.toContain('Node.js');
    expect(plan.links.map((l) => l.kind)).toEqual(['github']);
    expect(plan.newRoles.map((r) => r.company)).toEqual(['Globex']);
    expect(plan.roleUpdates).toEqual([{ id: 'x', location: 'Bengaluru, India', responsibilities: read.roles[0]!.highlights, addSkills: ['Node.js'] }]);
    expect(plan.newEducation).toEqual([]);
    expect(plan.educationUpdates).toEqual([{ id: 'y', field: 'Computer Science', start: { date: '2017-01-01', precision: 'year' } }]);
  });

  it('has nothing to do once the profile holds it all', () => {
    const filled = planImport(empty, read);
    const after = {
      ...empty,
      headline: 'x', bio: 'x', phone: 'x', location: 'x', years: 2,
      links: filled.links.map((l) => l.url),
      skills: filled.skills,
      roles: filled.newRoles.map((r, i) => ({ id: String(i), company: r.company, title: r.title, start: r.start.date, location: r.location ?? 'x', responsibilities: r.highlights, skills: r.skills })),
      education: [{ id: 'e', institution: 'IIT Delhi', degree: 'B.Tech', field: 'Computer Science', start: '2017-01-01', end: '2021-01-01' }],
      certifications: ['AWS Certified Developer'],
      projects: ['Desi Etsy'],
    };
    const again = planImport(after, read);
    expect(again.changes).toEqual({ roles: 0, education: 0, skills: 0, certifications: 0, projects: 0, links: 0, updates: 0, fields: [] });
  });
});

describe('skillsNamedIn', () => {
  it('matches whole names, symbols included', () => {
    expect(skillsNamedIn('Wrote C++ and C# services, and some C.', ['C', 'C++', 'C#', 'Java'])).toEqual(['C', 'C++', 'C#']);
    expect(skillsNamedIn('Moved JavaScript to TypeScript', ['Java', 'TypeScript'])).toEqual(['TypeScript']);
  });
});
