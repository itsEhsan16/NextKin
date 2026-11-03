import { factsOfDocument, withFigures } from '@nextkin/shared/scoring/documentFacts';
import { CANONICAL_SCHEMA_VERSION, canonicalResumeSchema, type CanonicalResumeJson } from '@nextkin/shared/schemas/resumeContent';
import { describe, expect, it } from 'vitest';

import { redactContact } from '../src/ai/pii';
import { changesOf } from '../src/pipeline/stages/tailorChanges';
import { headlineOf, mergeTailored, rewrittenRoles, strippedInUse, type TailorRunInput } from '../src/pipeline/stages/tailorMerge';

/**
 * A tailored run's rules (toreview §110.3), applied by code to what the model wrote: what was
 * switched off is the base's verbatim, a quick edit touches two roles, an undated role is never
 * rewritten, the skills are the base's in the job's order plus the ticks, and the changes list
 * says only what the two versions show. Synthetic resume (L4).
 */

const line = (id: string, text: string, origin: 'user' | 'generated' = 'user', evidence: string[] = []) => ({ id, text, evidence, origin });

const BASE: CanonicalResumeJson = {
  schemaVersion: CANONICAL_SCHEMA_VERSION,
  headline: 'Backend engineer',
  summary: line('s0', 'Backend engineer working on payment systems.'),
  skills: ['Python', 'Go', 'PostgreSQL'].map((name, i) => ({ id: `k${i}`, name, evidence: [], origin: 'user' as const })),
  roles: [
    { roleId: 'pay', company: 'Lumen Pay', title: 'Senior Backend Engineer', start: '2020-03', end: null, skills: ['Go', 'PostgreSQL'], bullets: [line('a', 'Built the settlement service in Go'), line('b', 'Reworked PostgreSQL indexes for the ledger API')] },
    { roleId: 'mid', company: 'Northwind Retail', title: 'Backend Developer', start: '2013-01', end: '2019-12', skills: ['Go'], bullets: [line('c', 'Wrote the stock service in Go', 'generated', ['old#r4'])] },
    { roleId: 'shop', company: 'Cartwheel', title: 'Junior Developer', start: '2009-01', end: '2012-06', skills: ['Python'], bullets: [line('d', 'Developed order APIs in Python for 300 merchants')] },
    { roleId: 'old', company: 'Corner Shop', title: 'Assistant', start: null, end: null, skills: [], bullets: [line('e', 'Kept the stock list up to date')] },
  ],
  education: [{ factId: 'edu', institution: 'TU Example', degree: 'BSc Computer Science', start: null, end: null }],
  certifications: [],
  projects: [],
};

/** What the model wrote for every part: new text everywhere, as a full rewrite would. */
const GENERATED: CanonicalResumeJson = {
  ...BASE,
  headline: 'Payments backend engineer',
  summary: line('s', 'Backend engineer building payment services in Go.', 'generated', ['profile#summary']),
  skills: [{ id: 'k0', name: 'Go', evidence: ['pay'], origin: 'generated' }],
  roles: BASE.roles.map((role, ri) => ({ ...role, bullets: role.bullets.map((b, bi) => line(`b${ri}-${bi}`, `${b.text}, rewritten`, 'generated', [`${role.roleId}#r${bi}`])) })),
};

const JOB = { title: 'Senior Backend Engineer (m/w/d)', skills: ['Go', 'PostgreSQL', 'Kubernetes', 'Terraform', 'Redis'] };

const request = (patch: Partial<TailorRunInput> = {}): TailorRunInput => ({
  baseResumeId: 'r1',
  baseVersionId: 'v1',
  fixes: ['headline', 'summary', 'skills', 'experience', 'length'],
  experience: 'full',
  added: ['Terraform'],
  skipped: ['Kubernetes', 'Redis'],
  baselineScore: 53,
  sourcePages: 1,
  ...patch,
});

const texts = (doc: CanonicalResumeJson, roleId: string) => doc.roles.find((r) => r.roleId === roleId)?.bullets.map((b) => b.text);

describe('the tailored merge', () => {
  it('a quick edit rewrites the two most recent dated roles and keeps the rest verbatim', () => {
    const asked = request({ experience: 'quick', fixes: ['headline', 'skills', 'experience'] });
    const doc = mergeTailored({ base: BASE, generated: GENERATED, request: asked, job: JOB });
    expect(canonicalResumeSchema.parse(doc)).toEqual(doc);
    expect(texts(doc, 'pay')).toEqual(texts(GENERATED, 'pay'));
    expect(texts(doc, 'mid')).toEqual(texts(GENERATED, 'mid'));
    expect(texts(doc, 'shop')).toEqual(texts(BASE, 'shop'));
    expect(texts(doc, 'old')).toEqual(texts(BASE, 'old'));
    // Headers are facts: never the model's.
    expect(doc.roles.map((r) => [r.company, r.title, r.start, r.end])).toEqual(BASE.roles.map((r) => [r.company, r.title, r.start, r.end]));
    // Summary off: the base's, word for word.
    expect(doc.summary?.text).toBe(BASE.summary?.text);
    expect(doc.headline).toBe('Senior Backend Engineer');
    expect(doc.education).toEqual(BASE.education);
  });

  it('never rewrites an undated role, even on a full edit, and restores a role the checks emptied', () => {
    const emptied = { ...GENERATED, roles: GENERATED.roles.map((r) => (r.roleId === 'pay' ? { ...r, bullets: [] } : r)) };
    const asked = request();
    expect([...rewrittenRoles(BASE, asked)]).toEqual(['pay', 'mid', 'shop']);
    const doc = mergeTailored({ base: BASE, generated: emptied, request: asked, job: JOB });
    expect(texts(doc, 'old')).toEqual(texts(BASE, 'old'));
    expect(texts(doc, 'pay')).toEqual(texts(BASE, 'pay'));
    expect(texts(doc, 'shop')).toEqual(texts(GENERATED, 'shop'));
  });

  it('keeps the base’s skills, the job’s first in its order, the ticks placed by the job', () => {
    const on = mergeTailored({ base: BASE, generated: GENERATED, request: request(), job: JOB });
    expect(on.skills.map((s) => s.name)).toEqual(['Go', 'PostgreSQL', 'Terraform', 'Python']);
    const off = mergeTailored({ base: BASE, generated: GENERATED, request: request({ fixes: [] }), job: JOB });
    expect(off.skills.map((s) => s.name)).toEqual(['Python', 'Go', 'PostgreSQL', 'Terraform']);
  });

  it('with every part switched off, only the ticked keyword is new', () => {
    const doc = mergeTailored({ base: BASE, generated: GENERATED, request: request({ fixes: [] }), job: JOB });
    const plain = (d: CanonicalResumeJson) => ({ ...d, summary: d.summary?.text, skills: d.skills.map((s) => s.name), roles: d.roles.map((r) => ({ ...r, bullets: r.bullets.map((b) => b.text) })) });
    expect(plain(doc)).toEqual({ ...plain(BASE), skills: ['Python', 'Go', 'PostgreSQL', 'Terraform'] });
    expect(changesOf({ base: BASE, final: doc, request: request({ fixes: [] }), stripped: 0, pages: 1 })).toEqual([
      { label: 'Added Terraform, as you chose', left: false },
      { label: 'Kubernetes and Redis left out, as you chose', left: true },
    ]);
  });

  it('a kept line the model once wrote cites its own line of the base', () => {
    const doc = mergeTailored({ base: BASE, generated: GENERATED, request: request({ fixes: [] }), job: JOB });
    expect(doc.roles.find((r) => r.roleId === 'mid')?.bullets[0]?.evidence).toEqual(['mid#r0']);
    expect(doc.roles.find((r) => r.roleId === 'pay')?.bullets[0]?.evidence).toEqual([]);
  });

  it('says what changed, read off the two versions', () => {
    const asked = request({ experience: 'quick', fixes: ['headline', 'skills', 'experience'] });
    const doc = mergeTailored({ base: BASE, generated: GENERATED, request: asked, job: JOB });
    const changes = changesOf({ base: BASE, final: doc, request: asked, stripped: 2, pages: 1 });
    expect(changes.map((c) => c.label)).toEqual([
      'Headline aimed at Senior Backend Engineer',
      'Added Terraform, as you chose',
      'The skills this job asks for listed first',
      'Rewrote the bullets in Senior Backend Engineer · Lumen Pay',
      'Rewrote the bullets in Backend Developer · Northwind Retail',
      'Kubernetes and Redis left out, as you chose',
      'Left out 2 lines your resume doesn’t back',
    ]);
    expect(changes.filter((c) => c.left)).toHaveLength(2);
  });

  it('counts only the stripped lines from parts the run uses', () => {
    const asked = request({ experience: 'quick', fixes: ['skills', 'experience'] });
    const stripped = ['s', 'k0', 'b0-1', 'b1-0-r1', 'b2-0', 'header:pay'].map((claimId) => ({ claimId, reason: 'untraceable' }));
    expect(strippedInUse(stripped, BASE, asked).map((s) => s.claimId)).toEqual(['b0-1', 'b1-0-r1', 'header:pay']);
  });

  it('aims the headline without a posting’s marker', () => {
    expect(headlineOf('Senior Backend Engineer (m/w/d)')).toBe('Senior Backend Engineer');
    expect(headlineOf('Data Analyst (f/m/x) – Remote')).toBe('Data Analyst – Remote');
  });
});

describe('a resume as the facts a tailored version cites', () => {
  it('maps lines to citable facts, adds the ticks, and redacts contact details', () => {
    const doc: CanonicalResumeJson = { ...BASE, summary: line('s0', 'Reach me at sam@example.com for payments work.') };
    const facts = factsOfDocument(doc, { added: ['Terraform'], redact: redactContact });
    expect(facts.skills).toEqual(['Python', 'Go', 'PostgreSQL', 'Terraform']);
    expect(facts.summary).not.toMatch(/@/);
    expect(facts.roles.map((r) => r.id)).toEqual(['pay', 'mid', 'shop', 'old']);
    expect(facts.roles[0]?.responsibilities).toEqual(['Built the settlement service in Go', 'Reworked PostgreSQL indexes for the ledger API']);
    expect(facts.roles[3]?.start).toEqual({ year: 1970 });
    expect(facts.roles[0]?.end).toBeNull();
  });

  it('a place the user chose is a line there; the AI’s pick only lets that role name it (§162)', () => {
    const facts = factsOfDocument(BASE, {
      added: ['Kafka', 'Docker'],
      confirmed: [
        { keyword: 'Kafka', where: 'pay', by: 'you' },
        { keyword: 'Docker', where: 'pay', by: 'ai' },
      ],
    });
    const pay = facts.roles[0]!;
    expect(pay.responsibilities).toEqual(['Built the settlement service in Go', 'Reworked PostgreSQL indexes for the ledger API', 'Used Kafka']);
    expect(pay.skills).toEqual(expect.arrayContaining(['Kafka', 'Docker']));
  });

  it('one keyword at several places: a line at each of yours, a skill at each of the AI’s (§163)', () => {
    const facts = factsOfDocument(BASE, {
      added: ['Kafka', 'Docker'],
      confirmed: [
        { keyword: 'Kafka', where: 'pay', by: 'you' },
        { keyword: 'Kafka', where: 'mid', by: 'you' },
        { keyword: 'Docker', where: 'pay', by: 'ai' },
        { keyword: 'Docker', where: 'mid', by: 'ai' },
      ],
    });
    for (const role of facts.roles.slice(0, 2)) {
      expect(role.responsibilities.filter((r) => r === 'Used Kafka')).toHaveLength(1);
      expect(role.responsibilities.some((r) => r.includes('Docker'))).toBe(false);
      expect(role.skills).toEqual(expect.arrayContaining(['Kafka', 'Docker']));
    }
  });
});

describe('the user’s figures (toreview §129)', () => {
  const figure = { where: 'pay', line: 1, text: 'Reworked PostgreSQL indexes, cutting ledger API p99 latency by 45%' };
  const base = withFigures(BASE, [figure, { where: 'pay', line: 9, text: 'No such line' }, { where: 'nope', line: 0, text: 'No such role' }]);

  it('replace the line they name, as the user’s own words, and nothing else', () => {
    expect(texts(base, 'pay')).toEqual(['Built the settlement service in Go', figure.text]);
    expect(base.roles[0]!.bullets[1]).toMatchObject({ origin: 'user', evidence: [] });
    expect(base.roles.slice(1)).toEqual(BASE.roles.slice(1));
    expect(factsOfDocument(base).roles[0]!.responsibilities).toContain(figure.text);
  });

  it('survive a rewrite that dropped the result', () => {
    const lost: CanonicalResumeJson = { ...GENERATED, roles: GENERATED.roles.map((r) => (r.roleId === 'pay' ? { ...r, bullets: [line('n0', 'Built settlement services', 'generated', ['pay#r0']), line('n1', 'Tuned PostgreSQL indexes', 'generated', ['pay#r1'])] } : r)) };
    const merged = mergeTailored({ base, generated: lost, request: request({ figures: [figure] }), job: JOB });
    expect(texts(merged, 'pay')).toEqual(['Built settlement services', figure.text]);
  });

  it('leave a rewrite alone when it kept the figure', () => {
    const keptIt: CanonicalResumeJson = { ...GENERATED, roles: GENERATED.roles.map((r) => (r.roleId === 'pay' ? { ...r, bullets: [line('n1', 'Cut ledger API p99 latency by 45% with new PostgreSQL indexes', 'generated', ['pay#r1'])] } : r)) };
    const merged = mergeTailored({ base, generated: keptIt, request: request({ figures: [figure] }), job: JOB });
    expect(texts(merged, 'pay')).toEqual(['Cut ledger API p99 latency by 45% with new PostgreSQL indexes']);
  });

  it('join the role when no rewritten line cites them', () => {
    const none: CanonicalResumeJson = { ...GENERATED, roles: GENERATED.roles.map((r) => (r.roleId === 'pay' ? { ...r, bullets: [line('n0', 'Built settlement services', 'generated', ['pay#r0'])] } : r)) };
    const merged = mergeTailored({ base, generated: none, request: request({ figures: [figure] }), job: JOB });
    expect(texts(merged, 'pay')).toEqual(['Built settlement services', figure.text]);
  });
});

describe('no bolt-on lines (owner, toreview §159)', () => {
  it('drops a written line that only lists ticked keywords; they stay in Skills', () => {
    const generated: CanonicalResumeJson = {
      ...GENERATED,
      roles: GENERATED.roles.map((role) =>
        role.roleId === 'pay'
          ? { ...role, bullets: [...role.bullets, line('bolt', 'Used Terraform, Redis and Docker in the platform', 'generated', ['pay#r0'])] }
          : role,
      ),
    };
    const merged = mergeTailored({ base: BASE, generated, request: request({ added: ['Terraform', 'Redis', 'Docker'], skipped: [] }), job: JOB });
    expect(texts(merged, 'pay')).not.toContain('Used Terraform, Redis and Docker in the platform');
    expect(texts(merged, 'pay')).toContain('Built the settlement service in Go, rewritten');
    expect(merged.skills.map((s) => s.name)).toEqual(expect.arrayContaining(['Terraform', 'Redis', 'Docker']));
  });

  it('a bare "Experience" heading becomes "Work Experience"; a heading the file chose otherwise is kept', () => {
    const layout = (experience: string) => ({ order: ['summary', 'experience'], headings: { summary: 'Summary', experience } });
    const bare = mergeTailored({ base: { ...BASE, layout: layout('Experience') }, generated: GENERATED, request: request(), job: JOB });
    expect(bare.layout?.headings.experience).toBe('Work Experience');
    const own = mergeTailored({ base: { ...BASE, layout: layout('Professional Experience') }, generated: GENERATED, request: request(), job: JOB });
    expect(own.layout?.headings.experience).toBe('Professional Experience');
  });
});
