import { describe, expect, it } from 'vitest';

import { canonicalResumeSchema, type CanonicalResumeJson } from '../src/schemas/resumeContent';
import { resumeDocumentWriteSchema } from '../src/schemas/resumeDocument';
import { applyDocument, contactUrl, documentOf } from '../src/scoring/resumeDocument';
import { documentProblems } from '../src/scoring/resumeDocumentCheck';
import type { ResumeDocument, ResumeDocumentWrite } from '../src/models/resumeDocument';

/** toreview §124: the editor's document round-trips the canonical resume without losing a claim. */

const OWNER = { name: 'Jordan Avery', email: 'jordan@example.com', phone: '+1 555 010 0100' };
const IDS = { resumeId: 'r', versionId: 'v1', revision: 'h1' };

const DOC: CanonicalResumeJson = {
  schemaVersion: 1,
  summary: { id: 's', text: 'Builds payment systems.', evidence: ['profile#summary'], origin: 'generated' },
  skills: [
    { id: 'k0', name: 'Go', evidence: ['r1'], origin: 'generated' },
    { id: 'k1', name: 'PostgreSQL', evidence: ['r1'], origin: 'generated' },
  ],
  skillGroups: [{ label: 'Languages', names: ['Go'] }],
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
        { id: 'b1', text: 'Built the merchant portal.', evidence: ['r1#r1'], origin: 'generated' },
      ],
      entries: [{ title: 'Merchant portal', tech: 'React', bulletIds: ['b1'] }],
    },
  ],
  education: [{ factId: 'e1', institution: 'TU Berlin', degree: 'BSc', field: 'Computer Science', start: '2014', end: '2018' }],
  certifications: [],
  projects: [],
};

const writeOf = (doc: ResumeDocument): ResumeDocumentWrite => {
  const { resumeId: _r, versionId: _v, revision: _rv, pendingReview: _p, ...write } = doc;
  return write;
};

describe('documentOf', () => {
  it('reads the account header, the groups and a role’s client project', () => {
    const doc = documentOf(DOC, IDS, OWNER);
    expect(doc.header).toEqual({ name: 'Jordan Avery', headline: '', items: [{ id: 'c-phone', text: '+1 555 010 0100' }, { id: 'c-email', text: 'jordan@example.com' }] });
    expect(doc.skills).toEqual({ groups: [{ id: 'g0', label: 'Languages', skills: ['Go'] }], loose: ['PostgreSQL'] });
    expect(doc.experience[0]!.bullets.map((b) => b.id)).toEqual(['b0']);
    expect(doc.experience[0]!.groups).toEqual([{ id: 'r1-g0', title: 'Merchant portal', tech: 'React', bullets: [{ id: 'b1', text: 'Built the merchant portal.' }] }]);
    expect(doc.order).toEqual(['summary', 'skills', 'experience', 'projects', 'education', 'certifications']);
    expect(doc.template).toBe('jake');
    expect(resumeDocumentWriteSchema.safeParse(writeOf(doc)).success).toBe(true);
  });

  it('reads a placeholder the user left as blank', () => {
    const zero = { ...DOC, roles: [{ ...DOC.roles[0]!, company: '[Company Name]' }] };
    expect(documentOf(zero, IDS, OWNER).experience[0]!.company).toBe('');
  });
});

describe('applyDocument', () => {
  it('round-trips unchanged: every claim keeps its evidence', () => {
    const doc = documentOf(DOC, IDS, OWNER);
    const next = applyDocument(DOC, writeOf(doc));
    expect(canonicalResumeSchema.safeParse(next).success).toBe(true);
    expect(next.roles[0]!.bullets).toEqual(DOC.roles[0]!.bullets);
    expect(next.roles[0]!.entries).toEqual(DOC.roles[0]!.entries);
    expect(next.summary).toEqual(DOC.summary);
    expect(next.skills).toEqual(DOC.skills);
    expect(next.header).toEqual({ name: 'Jordan Avery', items: [{ text: '+1 555 010 0100', url: 'tel:+15550100100' }, { text: 'jordan@example.com', url: 'mailto:jordan@example.com' }] });
  });

  it('makes a changed line the user’s, keeping its id and its client project', () => {
    const doc = documentOf(DOC, IDS, OWNER);
    doc.experience[0]!.groups[0]!.bullets[0]!.text = 'Built the merchant portal in React.';
    const next = applyDocument(DOC, writeOf(doc));
    expect(next.roles[0]!.bullets[1]).toEqual({ id: 'b1', text: 'Built the merchant portal in React.', evidence: [], origin: 'user' });
    expect(next.roles[0]!.entries).toEqual([{ title: 'Merchant portal', tech: 'React', bulletIds: ['b1'] }]);
  });

  it('adds a role, a custom section and a template; a fully blank role is dropped', () => {
    const doc = documentOf(DOC, IDS, OWNER);
    doc.experience.push({ id: 'n-1', company: 'Globex', title: 'Engineer', location: '', start: '2018', end: '2021', bullets: [{ id: 'n-2', text: 'Shipped billing.' }], groups: [] });
    doc.experience.push({ id: 'n-3', company: '', title: '', location: '', start: null, end: null, bullets: [], groups: [] });
    doc.custom.push({ id: 'awards', heading: 'Awards', entries: [], lines: [{ id: 'n-4', text: 'Hackathon winner, 2020' }] });
    doc.order.push('x:awards');
    doc.template = 'modern';
    const next = applyDocument(DOC, writeOf(doc));
    expect(canonicalResumeSchema.safeParse(next).success).toBe(true);
    expect(next.roles.map((r) => r.roleId)).toEqual(['r1', 'n-1']);
    expect(next.sections?.[0]?.lines[0]?.text).toBe('Hackathon winner, 2020');
    expect(next.layout?.order.at(-1)).toBe('x:awards');
    expect(next.template).toBe('modern');
  });

  it('never reuses an id another line already holds', () => {
    const doc = documentOf(DOC, IDS, OWNER);
    doc.experience[0]!.bullets.push({ id: 'b1', text: 'A copied line.' });
    const next = applyDocument(DOC, writeOf(doc));
    const ids = next.roles[0]!.bullets.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('documentProblems', () => {
  it('names what a download needs', () => {
    const doc = documentOf(DOC, IDS, OWNER);
    expect(documentProblems(doc)).toEqual([]);
    doc.header.name = ' ';
    doc.experience[0]!.company = '';
    expect(documentProblems(doc).map((p) => p.message)).toEqual(['Add your name at the top.', 'Senior Engineer: add the employer.']);
  });

  it('refuses an empty page', () => {
    const empty = documentOf({ schemaVersion: 1, skills: [], roles: [], education: [], certifications: [], projects: [] }, IDS, OWNER);
    expect(documentProblems(empty)[0]?.message).toMatch(/at least one section/);
  });
});

describe('contactUrl', () => {
  it('links what an item says', () => {
    expect(contactUrl({ text: 'linkedin.com/in/jordan' })).toBe('https://linkedin.com/in/jordan');
    expect(contactUrl({ text: 'LinkedIn', url: 'linkedin.com/in/jordan' })).toBe('https://linkedin.com/in/jordan');
    expect(contactUrl({ text: 'Berlin, Germany' })).toBeUndefined();
  });
});
