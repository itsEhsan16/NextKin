import { factsOfDocument } from '@nextkin/shared/scoring/documentFacts';
import { CANONICAL_SCHEMA_VERSION, type CanonicalResumeJson } from '@nextkin/shared/schemas/resumeContent';
import { describe, expect, it } from 'vitest';

import type { StageJd } from '../src/pipeline/stages/common';
import { fitToPages, removalOrder, safeRemovals, spareSkills, without, type Measure, type Removal } from '../src/pipeline/stages/pageFit';
import { worthAgainst, worthGuard, scoringJdOfStage } from '../src/pipeline/stages/persist';

/**
 * A page fit never lowers the score (owner, 2026-11-25). A graduate's resume as the tailor leaves
 * it: one three-bullet internship, three projects, the job's keywords accepted into Skills, and an
 * extracurricular entry. The measure stands in for the compiler: one page holds `ROOM` units, a
 * bullet is two and a skill a fifth of one. Synthetic (L4).
 */

const line = (id: string, text: string) => ({ id, text, evidence: [], origin: 'user' as const });
const skill = (name: string, id: string) => ({ id, name, evidence: [], origin: 'user' as const });

const OWN = ['Python', 'Java', 'SQL', 'TypeScript', 'React', 'Next.js', 'PostgreSQL', 'Supabase', 'Tailwind CSS', 'Linux', 'Normalization', 'Query Optimization'];
const ACCEPTED = ['product management', 'user research', 'market research', 'competitive analysis', 'user stories', 'acceptance criteria', 'product metrics', 'prompt engineering', 'Figma', 'Jira'];

const DOC: CanonicalResumeJson = {
  schemaVersion: CANONICAL_SCHEMA_VERSION,
  headline: 'Product Manager Graduate Trainee',
  summary: line('s', 'Computer Science graduate moving into product management, with internship and project work across the full software lifecycle.'),
  skills: [...OWN.map((n, i) => skill(n, `kept-k${i}`)), ...ACCEPTED.map((n, i) => skill(n, `added-${i}`))],
  skillGroups: [
    { label: 'Languages', names: ['Python', 'Java', 'SQL', 'TypeScript'] },
    { label: 'Front End', names: ['React', 'Next.js', 'Tailwind CSS'] },
    { label: 'Databases', names: ['PostgreSQL', 'Supabase', 'Normalization', 'Query Optimization'] },
    { label: 'Product', names: [...ACCEPTED, 'Linux'] },
  ],
  roles: [
    {
      roleId: 'intern',
      company: 'Brightleaf',
      title: 'Developer Intern',
      start: '2025-07',
      end: '2025-09',
      skills: [],
      bullets: [
        line('r0', 'Collaborated with mentors across the full software lifecycle, writing user stories and acceptance criteria.'),
        line('r1', 'Built a marketplace where sellers list handmade products for online sale.'),
        line('r2', 'Delivered a food delivery platform, tracking product metrics for the ordering flow.'),
      ],
    },
  ],
  education: [{ factId: 'edu', institution: 'Example University', degree: 'B.Tech', field: 'Computer Science', start: '2022-09', end: '2026-01' }],
  certifications: [],
  projects: [
    {
      factId: 'links',
      name: 'Link analytics',
      tech: 'React, TypeScript, Supabase, SQL',
      start: '2025-06',
      end: '2025-09',
      bullets: [
        line('p0', 'Developed a real-time analytics dashboard in React and TypeScript showing product metrics.'),
        line('p1', 'Built the redirect and short-link services behind it.'),
        line('p2', 'Enforced data isolation and added rate limiting on public endpoints.'),
      ],
    },
    {
      factId: 'shop',
      name: 'Home services shop',
      tech: 'Next.js, TypeScript, PostgreSQL',
      start: '2026-05',
      end: '2026-05',
      bullets: [
        line('q0', 'Designed the PostgreSQL schema and built the order APIs, informed by user research with 12 customers.'),
        line('q1', 'Built separate customer and admin interfaces in Next.js.'),
        line('q2', 'Integrated media delivery and error monitoring.'),
      ],
    },
  ],
  sections: [{ id: 'extra', heading: 'Extracurricular', lines: [], entries: [{ title: 'Coding Club', subtitle: 'Core Member', right: '2022 - 2026', bullets: [line('x0', 'Ran workshops and technical events for student audiences.')] }] }],
};

const JD: StageJd = {
  id: 'jd',
  title: 'Product Manager Graduate Trainee',
  company: 'Example Co',
  location: null,
  requiredSkills: ['product management', 'user research', 'market research', 'user stories', 'acceptance criteria', 'product metrics'],
  preferredSkills: ['competitive analysis', 'prompt engineering', 'SQL'],
  tools: ['Figma', 'Jira'],
  responsibilities: [],
  rawText: 'Product Manager Graduate Trainee. You will do product management, user research, market research and competitive analysis, write user stories and acceptance criteria, track product metrics, and use SQL, Figma, Jira and prompt engineering.',
  completeness: 'full',
  language: 'en',
  titled: true,
};

const JOB_SKILLS = [...JD.requiredSkills, ...JD.preferredSkills, ...JD.tools];
const CONTACT = { email: true, phone: true, location: true };
const AS_OF = { year: 2026, month: 11 };
const facts = factsOfDocument(DOC);
const worth = (document: CanonicalResumeJson) => worthAgainst({ document, facts, contact: CONTACT, jd: scoringJdOfStage(JD), asOf: AS_OF });
const guard = () => worthGuard({ document: DOC, facts, contact: CONTACT, jd: JD, asOf: AS_OF });

const units = (doc: CanonicalResumeJson) =>
  doc.skills.length * 0.2 + 2 * (doc.roles.flatMap((r) => r.bullets).length + doc.projects.flatMap((p) => p.bullets).length + (doc.sections ?? []).flatMap((s) => s.entries.flatMap((e) => e.bullets)).length);
const measure = (room: number): Measure => async (doc, density) => Math.ceil(units(doc) / (room + density));
const names = (doc: CanonicalResumeJson) => doc.skills.map((s) => s.name);

describe('what a fit may leave out', () => {
  it('lists own skills the job does not ask for and no line uses, never an accepted keyword', () => {
    const spare = spareSkills(DOC, JOB_SKILLS);
    expect(spare).toEqual(expect.arrayContaining(['Python', 'Java', 'Linux', 'Normalization', 'Query Optimization']));
    // Used by a project line or its stack, or asked for by the job.
    for (const used of ['React', 'TypeScript', 'Next.js', 'PostgreSQL', 'Supabase', 'SQL']) expect(spare).not.toContain(used);
    for (const accepted of ACCEPTED) expect(spare).not.toContain(accepted);
    expect(spareSkills(DOC, [])).toEqual([]);
  });

  it('orders skills, then extra-section lines, then bullets, keeping three role bullets and two per project', () => {
    const order = removalOrder(DOC, new Set(['intern']), JOB_SKILLS);
    const kinds = order.map((r) => (r.kind === 'bullet' ? r.in : r.kind));
    // Skills, the club's bullet, a project down to two lines, then to one, then the club itself.
    expect(kinds.join(',')).toMatch(/^(skill,)+section,project,project,project,project,entry$/);
    expect(order.filter((r) => r.kind === 'bullet' && r.in === 'role')).toEqual([]);
    const projects = order.flatMap((r) => (r.kind === 'bullet' && r.in === 'project' ? [r.id] : []));
    // First each project's weakest line; the one naming a job skill or holding a number is kept longest.
    expect(projects.slice(0, 2).sort()).toEqual(['p2', 'q2']);
    expect(projects).not.toContain('p0');
    expect(projects).not.toContain('q0');
  });

  it('removes a skill from its skill line too, and a bullet from where it is', () => {
    const next = without(DOC, [{ kind: 'skill', name: 'Linux' }, { kind: 'bullet', in: 'project', id: 'p2' }, { kind: 'bullet', in: 'section', id: 'x0' }]);
    expect(names(next)).not.toContain('Linux');
    expect(next.skillGroups!.flatMap((g) => g.names)).not.toContain('Linux');
    expect(next.projects[0]!.bullets.map((b) => b.id)).toEqual(['p0', 'p1']);
    expect(next.sections![0]!.entries[0]!.bullets).toEqual([]);
    expect(next.roles).toEqual(DOC.roles);
  });
});

describe('what a fit never leaves out', () => {
  const withCerts: CanonicalResumeJson = { ...DOC, sections: [...DOC.sections!, { id: 'certs', heading: 'Certifications', entries: [], lines: [line('c0', 'Cloud Data Analytics Certificate'), line('c1', 'Workshops: Git and GitHub')] }] };

  it('a certifications section, or any line that is not under an entry', () => {
    const order = removalOrder(withCerts, new Set(['intern']), JOB_SKILLS);
    expect(order.filter((r) => r.kind === 'bullet' && r.in === 'section')).toEqual([{ kind: 'bullet', in: 'section', id: 'x0' }]);
    expect(order.filter((r) => r.kind === 'entry')).toEqual([{ kind: 'entry', section: 'extra', title: 'Coding Club' }]);
  });

  it('a skill a project names under another spelling ("React.js" for a line that says React)', () => {
    const doc = { ...DOC, skills: DOC.skills.map((s) => (s.name === 'React' ? { ...s, name: 'React.js' } : s)) };
    expect(spareSkills(doc, JOB_SKILLS)).not.toContain('React.js');
  });

  it('takes a whole extra entry out with its section when it was the only one', () => {
    const next = without(withCerts, [{ kind: 'entry', section: 'extra', title: 'Coding Club' }]);
    expect(next.sections!.find((s) => s.id === 'extra')!.entries).toEqual([]);
    expect(next.sections!.find((s) => s.id === 'certs')!.lines).toHaveLength(2);
  });
});

describe('the score guard', () => {
  it('refuses a removal that costs a keyword or points, and allows one that costs nothing', () => {
    const holds = guard();
    expect(holds(without(DOC, [{ kind: 'skill', name: 'Python' }]))).toBe(true);
    expect(holds(without(DOC, [{ kind: 'skill', name: 'Figma' }]))).toBe(false);
    expect(holds(without(DOC, [{ kind: 'bullet', in: 'project', id: 'p2' }]))).toBe(true);
  });

  it('keeps, of any order, only the removals that leave the document worth as much', () => {
    const order: Removal[] = [{ kind: 'skill', name: 'Jira' }, { kind: 'skill', name: 'Java' }, { kind: 'skill', name: 'market research' }, { kind: 'bullet', in: 'section', id: 'x0' }];
    const safe = safeRemovals(DOC, order, guard());
    expect(safe).toEqual([{ kind: 'skill', name: 'Java' }, { kind: 'bullet', in: 'section', id: 'x0' }]);
    const before = worth(DOC);
    const after = worth(without(DOC, safe));
    expect(after.points).toBeGreaterThanOrEqual(before.points);
    expect(after.matched).toBeGreaterThanOrEqual(before.matched);
  });
});

describe('fitting a graduate’s resume to one page', () => {
  const order = () => safeRemovals(DOC, removalOrder(DOC, new Set(['intern']), JOB_SKILLS), guard());
  const fit = (room: number) => fitToPages({ doc: DOC, budget: 1, mayTrim: true, order, measure: measure(room), compiled: true });

  it('reaches one page with the score and every accepted keyword intact', async () => {
    const result = await fit(21); // 24.4 units now; 23 fit at the tightest spacing
    expect(result.pages).toBe(1);
    expect(result.dropped).toBeGreaterThan(0);
    for (const accepted of ACCEPTED) expect(names(result.doc)).toContain(accepted);
    expect(result.doc.roles[0]!.bullets).toHaveLength(3);
    const [before, after] = [worth(DOC), worth(result.doc)];
    expect(after.points).toBeGreaterThanOrEqual(before.points);
    expect(after.matched).toBe(before.matched);
  });

  it('gives the skills back when leaving them out freed no room', async () => {
    // A bullet is what frees the page here: the measure counts bullets only.
    const bulletsOnly: Measure = async (doc, density) => Math.ceil((units(doc) - doc.skills.length * 0.2) / (17 + density));
    const result = await fitToPages({ doc: DOC, budget: 1, mayTrim: true, order, measure: bulletsOnly, compiled: true });
    expect(result.pages).toBe(1);
    expect(names(result.doc)).toEqual(names(DOC));
    expect(result.removed.every((r) => r.kind === 'bullet')).toBe(true);
  });

  it('leaves every line when one page cannot be reached without lowering the score', async () => {
    const result = await fit(10);
    expect(result).toMatchObject({ dropped: 0, doc: DOC, density: 2 });
    expect(result.pages).toBeGreaterThan(1);
  });

  it('does not score anything when the spacing alone fits', async () => {
    let asked = 0;
    const result = await fitToPages({ doc: DOC, budget: 1, mayTrim: true, order: () => (asked++, []), measure: measure(24), compiled: true });
    expect(result).toMatchObject({ pages: 1, dropped: 0, density: 1 });
    expect(asked).toBe(0);
  });
});
