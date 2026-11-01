import { describe, expect, it } from 'vitest';

import type { CanonicalResumeJson } from '../src/schemas/resumeContent';
import { lineSourcesOf, lineSourcesOfContent } from '../src/scoring/lineSources';

/** Where each line came from, read off its citations (toreview §146.4). Synthetic. */

const claim = (id: string, text: string, origin: 'generated' | 'user' | 'assumed', evidence: string[] = []) => ({
  id,
  text,
  origin,
  evidence,
});

const ROLE = { roleId: 'role_1', company: 'Acme', title: 'Designer', start: '2021-03', end: '2024-01', skills: ['Figma'] };

const doc = (over: Partial<CanonicalResumeJson>): CanonicalResumeJson =>
  ({
    schemaVersion: 1,
    skills: [],
    roles: [],
    education: [],
    certifications: [],
    projects: [],
    ...over,
  }) as CanonicalResumeJson;

const BASE = doc({
  summary: claim('s0', 'Designer who ships.', 'user'),
  roles: [{ ...ROLE, bullets: [claim('b0', 'Shipped the checkout', 'user')] }],
  projects: [{ factId: 'proj_1', name: 'Atlas', bullets: [claim('p0', 'Built the map', 'user')] }],
});

const line = (sources: ReturnType<typeof lineSourcesOf>, text: string) =>
  sources.find((source) => source.text === text);

describe('lineSourcesOf', () => {
  it('gives back the line the AI reworded, and the role it rests on', () => {
    const tailored = doc({
      roles: [{ ...ROLE, bullets: [claim('b1', 'Rebuilt checkout for mobile', 'generated', ['role_1#r0'])] }],
    });
    expect(line(lineSourcesOf(tailored, BASE), 'Rebuilt checkout for mobile')).toEqual({
      text: 'Rebuilt checkout for mobile',
      origin: 'generated',
      facts: ['Your Designer role at Acme'],
      before: 'Shipped the checkout',
    });
  });

  it('has no "before" for a line that is unchanged', () => {
    const tailored = doc({
      roles: [{ ...ROLE, bullets: [claim('b1', 'Shipped the checkout', 'generated', ['role_1#r0'])] }],
    });
    expect(line(lineSourcesOf(tailored, BASE), 'Shipped the checkout')?.before).toBeUndefined();
  });

  it('says a person’s own line is theirs, with nothing to cite', () => {
    expect(line(lineSourcesOf(BASE), 'Shipped the checkout')).toEqual({
      text: 'Shipped the checkout',
      origin: 'user',
      facts: [],
    });
  });

  it('keeps an assumption marked as one', () => {
    const zero = doc({ roles: [{ ...ROLE, assumed: true, bullets: [claim('b1', 'Led a team', 'assumed')] }] });
    const sources = lineSourcesOf(zero);
    expect(line(sources, 'Led a team')?.origin).toBe('assumed');
    expect(line(sources, 'Designer')?.origin).toBe('assumed');
  });

  it('reads a summary and project lines back through their own citations', () => {
    const tailored = doc({
      summary: claim('s1', 'Designer aimed at fintech.', 'generated', ['profile#summary', 'role_1']),
      projects: [{ factId: 'proj_1', name: 'Atlas', bullets: [claim('p1', 'Built a fast map', 'generated', ['proj_1#p0'])] }],
    });
    const sources = lineSourcesOf(tailored, BASE);
    expect(line(sources, 'Designer aimed at fintech.')).toEqual({
      text: 'Designer aimed at fintech.',
      origin: 'generated',
      facts: ['Your summary', 'Your Designer role at Acme'],
      before: 'Designer who ships.',
    });
    expect(line(sources, 'Built a fast map')?.before).toBe('Built the map');
  });

  it('names the role a skill was tagged at', () => {
    const tagged = doc({
      roles: [{ ...ROLE, bullets: [] }],
      skills: [{ name: 'Figma', id: 'sk_1', evidence: ['role_1'], origin: 'user' }] as CanonicalResumeJson['skills'],
    });
    expect(line(lineSourcesOf(tagged), 'Figma')?.facts).toEqual(['Your Designer role at Acme']);
  });

  it('covers schools and certificates, which are plain facts', () => {
    const facts = doc({
      education: [{ factId: 'edu_1', institution: 'Example University', degree: 'BSc' }],
      certifications: [{ factId: 'cert_1', name: 'AWS Architect' }],
    });
    const sources = lineSourcesOf(facts);
    expect(line(sources, 'BSc')?.facts).toEqual(['Your BSc at Example University']);
    expect(line(sources, 'AWS Architect')?.facts).toEqual(['Your AWS Architect certification']);
  });

  it('ignores a citation it can’t place rather than guess', () => {
    const lost = doc({ roles: [{ ...ROLE, bullets: [claim('b1', 'A line', 'generated', ['gone#r3'])] }] });
    expect(line(lineSourcesOf(lost), 'A line')?.facts).toEqual([]);
  });
});

describe('lineSourcesOfContent', () => {
  const content = {
    kind: 'resume',
    resumeId: 'r',
    versionId: 'v',
    summary: 'A summary',
    skills: ['Figma'],
    experience: [{ id: 'e', company: 'Acme', title: 'Designer', period: '', bullets: ['A line'] }],
    projects: [],
    certifications: [],
    education: [],
  } as Parameters<typeof lineSourcesOfContent>[0];

  it('calls a tailored document the AI’s, and a base one the person’s', () => {
    expect(line(lineSourcesOfContent(content, true), 'A line')?.origin).toBe('generated');
    expect(line(lineSourcesOfContent(content, false), 'A line')?.origin).toBe('user');
    expect(line(lineSourcesOfContent(content, true), 'Figma')?.origin).toBe('user');
  });
});
