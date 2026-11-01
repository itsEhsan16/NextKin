import { CANONICAL_SCHEMA_VERSION, canonicalResumeSchema, type CanonicalResumeJson } from '@nextkin/shared/schemas/resumeContent';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { groundedModel } from '../../evals/referenceModel';
import type { FakeScript } from '../../src/ai/providers/fake';
import { loadConfig } from '../../src/config';
import { createDatabase, type Database } from '../../src/db/database';
import * as generations from '../../src/services/generations';
import { getLineSources, getVersionChanges } from '../../src/services/resumeRead';
import { compareResumeToJd } from '../../src/services/tailorCompare';
import { insertVersion } from '../../src/services/versions';
import { backendUser, readyJd, runToEnd } from './fixtures/documents';
import { deleteUsers } from './fixtures/pipeline';

/**
 * Tailoring against the whole JD (toreview §112): the comparison names each keyword's JD line, the
 * resume's places and a job match; a ticked keyword the user confirms at a role becomes a fact of
 * that role, is tagged there, and counts towards the new version's job match. Synthetic (L4).
 */
const config = loadConfig();
let db: Database;
const users: string[] = [];

beforeAll(() => {
  db = createDatabase({ appUrl: config.DATABASE_URL, maintenanceUrl: config.DATABASE_MAINTENANCE_URL, poolMax: 4 });
});
afterAll(async () => {
  await deleteUsers(db, users);
  await db.destroy();
});

const line = (id: string, text: string) => ({ id, text, evidence: [] as string[], origin: 'user' as const });

const BASE: CanonicalResumeJson = {
  schemaVersion: CANONICAL_SCHEMA_VERSION,
  headline: 'Backend engineer',
  summary: line('s0', 'Backend engineer working on payment systems.'),
  skills: ['Go', 'PostgreSQL'].map((name, i) => ({ id: `k${i}`, name, evidence: [], origin: 'user' as const })),
  roles: [
    { roleId: 'pay', company: 'Lumen Pay', title: 'Backend Engineer', start: '2021-03', end: null, skills: ['Go', 'PostgreSQL'], bullets: [line('a', 'Built the settlement service in Go for 300 merchants'), line('b', 'Reworked PostgreSQL indexes for the ledger API')] },
  ],
  education: [],
  certifications: [],
  projects: [],
};

describe('tailoring against the whole JD (toreview §112)', () => {
  it('confirms a keyword at a role, and the job match counts it', async () => {
    const userId = await backendUser(db, users);
    const identity = { userId, role: 'user' as const };
    const jd = await readyJd(db, userId, groundedModel);
    const resumeId = await db.withUser(identity, async (tx) => {
      const resume = await tx.insertInto('resumes').values({ user_id: userId, title: 'My resume', doc_type: 'resume', source: 'uploaded', is_base: true }).returning('id').executeTakeFirstOrThrow();
      await insertVersion(tx, { userId, resumeId: resume.id, content: BASE, note: 'Uploaded', createdBy: 'user' });
      return resume.id;
    });

    const comparison = await compareResumeToJd(db, identity, jd.id, resumeId);
    expect(comparison.places).toEqual([{ id: 'pay', label: 'Backend Engineer · Lumen Pay' }]);
    expect(comparison.keywords.find((k) => k.label === 'Kubernetes')).toMatchObject({ onResume: false, quote: expect.stringContaining('running Kubernetes in production') });
    expect(comparison.jobMatch).toMatchObject({ missing: expect.arrayContaining(['Kubernetes']) });
    // The fix plan (toreview §115): a missing keyword is priced as what it would add if the user has it.
    expect(comparison.plan?.parts.map((p) => p.key)).toContain('keywords');
    expect(comparison.plan?.steps.find((step) => step.title === 'Add Kubernetes')).toMatchObject({ who: 'you', importance: 'required', need: expect.stringContaining('Kubernetes') });
    expect(comparison.plan?.steps.find((step) => step.title === 'Add Kubernetes')?.worth).toBeGreaterThan(0);
    const before = comparison.jobMatch!;

    const tailoring = { fixes: ['skills', 'experience'], experience: 'quick', keywords: [], confirmed: [{ keyword: 'Kubernetes', where: 'pay', note: 'deployed the settlement service on a managed cluster' }, { keyword: 'Redis', where: 'nowhere' }] };
    const run = await runToEnd(db, userId, 'resume', { jdId: jd.id, baseResumeId: resumeId, tailoring }, groundedModel);
    expect(run.outcome).toBe('completed');

    const generation = await generations.getGeneration(db, identity, run.generationId);
    // A confirmation naming no place of this resume is ignored, and its keyword stays left out.
    expect(generation.tailor?.confirmed).toEqual([{ keyword: 'Kubernetes', where: 'pay', note: 'deployed the settlement service on a managed cluster' }]);
    expect(generation.tailor?.added).toEqual(['Kubernetes']);
    expect(generation.tailor?.skipped).toContain('Redis');

    const version = await db.withUser(identity, (tx) => tx.selectFrom('resume_versions').select('content').where('generation_id', '=', run.generationId).executeTakeFirstOrThrow());
    const doc = canonicalResumeSchema.parse(version.content);
    expect(doc.roles[0]!.skills).toContain('Kubernetes');
    expect(JSON.stringify(doc)).not.toMatch(/Redis/);

    const after = generation.tailor?.jobMatch;
    expect(after?.missing).not.toContain('Kubernetes');
    expect(after?.matched).toBeGreaterThan(before.matched);
    expect(after?.total).toBe(before.total);
  });
});

describe('tailored projects (toreview §113)', () => {
  /** Rewords the first project's bullets in its own stack, and slips a number into the second's. */
  const projectsModel: FakeScript = (request, n) => {
    const answer = groundedModel(request, n);
    if (request.output?.name !== 'resume' || !answer || !('data' in answer)) return answer;
    const draft = answer.data as { projects: { projectId: string; bullets: { text: string; evidence: string[] }[] }[] };
    return {
      ...answer,
      data: {
        ...draft,
        projects: draft.projects.map((p) => ({
          ...p,
          bullets: p.bullets.map((b) => ({ ...b, text: p.projectId === 'lt' ? `${b.text} in React` : `${b.text} for 5,000 users` })),
        })),
      },
    };
  };

  it('takes a project rewrite that passes the check, and keeps a project whose rewrite invents a number', async () => {
    const userId = await backendUser(db, users);
    const identity = { userId, role: 'user' as const };
    const jd = await readyJd(db, userId, groundedModel);
    const withProjects: CanonicalResumeJson = {
      ...BASE,
      projects: [
        { factId: 'lt', name: 'LinkTrack', tech: 'React, PostgreSQL', start: '2025-06', end: '2025-09', bullets: [line('p0', 'Built a click dashboard')] },
        { factId: 'pk', name: 'Peckers', tech: 'Next.js', bullets: [line('p1', 'Shipped a restaurant website')] },
      ],
    };
    const resumeId = await db.withUser(identity, async (tx) => {
      const resume = await tx.insertInto('resumes').values({ user_id: userId, title: 'My resume', doc_type: 'resume', source: 'uploaded', is_base: true }).returning('id').executeTakeFirstOrThrow();
      await insertVersion(tx, { userId, resumeId: resume.id, content: withProjects, note: 'Uploaded', createdBy: 'user' });
      return resume.id;
    });
    const run = await runToEnd(db, userId, 'resume', { jdId: jd.id, baseResumeId: resumeId, tailoring: { fixes: ['projects'], keywords: [] } }, projectsModel);
    expect(run.outcome).toBe('completed');
    const version = await db.withUser(identity, (tx) => tx.selectFrom('resume_versions').select('content').where('generation_id', '=', run.generationId).executeTakeFirstOrThrow());
    const doc = canonicalResumeSchema.parse(version.content);
    expect(doc.projects.map((p) => p.bullets.map((b) => b.text))).toEqual([['Built a click dashboard in React'], ['Shipped a restaurant website']]);
    const generation = await generations.getGeneration(db, identity, run.generationId);
    expect(generation.tailor?.changes).toEqual(expect.arrayContaining([{ label: 'Rewrote the bullets in LinkTrack', left: false }]));
  });
});

describe('the AI places a ticked keyword (toreview §116)', () => {
  /** Works the ticked keyword into the first bullet of the role it fits, as the prompt asks. */
  const placing: FakeScript = (request, n) => {
    const answer = groundedModel(request, n);
    if (request.output?.name !== 'resume' || !answer || !('data' in answer)) return answer;
    const draft = answer.data as { roles: { roleId: string; bullets: { text: string; evidence: string[] }[] }[] };
    return {
      ...answer,
      data: { ...draft, roles: draft.roles.map((r) => (r.roleId === 'pay' ? { ...r, bullets: r.bullets.map((b, i) => (i === 0 ? { ...b, text: `${b.text}, deployed on Kubernetes` } : b)) } : r)) },
    };
  };

  it('keeps it where a rewritten line says it, tags that role, and names the place for the user to check', async () => {
    const userId = await backendUser(db, users);
    const identity = { userId, role: 'user' as const };
    const jd = await readyJd(db, userId, groundedModel);
    const resumeId = await db.withUser(identity, async (tx) => {
      const resume = await tx.insertInto('resumes').values({ user_id: userId, title: 'My resume', doc_type: 'resume', source: 'uploaded', is_base: true }).returning('id').executeTakeFirstOrThrow();
      await insertVersion(tx, { userId, resumeId: resume.id, content: BASE, note: 'Uploaded', createdBy: 'user' });
      return resume.id;
    });
    const run = await runToEnd(db, userId, 'resume', { jdId: jd.id, baseResumeId: resumeId, tailoring: { fixes: ['experience'], experience: 'full', keywords: ['Kubernetes'] } }, placing);
    expect(run.outcome).toBe('completed');
    const version = await db.withUser(identity, (tx) => tx.selectFrom('resume_versions').select('content').where('generation_id', '=', run.generationId).executeTakeFirstOrThrow());
    const doc = canonicalResumeSchema.parse(version.content);
    expect(doc.roles[0]!.bullets[0]!.text).toMatch(/deployed on Kubernetes$/);
    expect(doc.roles[0]!.skills).toContain('Kubernetes');
    const generation = await generations.getGeneration(db, identity, run.generationId);

    // Any line can say where it came from: the role it rests on, and the line it replaced (§146.4).
    const line = doc.roles[0]!.bullets[0]!;
    const sources = await getLineSources(db, identity, generation.resumeId!);
    expect(sources.find((source) => source.text === line.text)).toMatchObject({
      origin: 'generated',
      facts: [`Your ${doc.roles[0]!.title} role at ${doc.roles[0]!.company}`],
      before: BASE.roles[0]!.bullets[0]!.text,
    });

    // The Versions page says the same: the rewording, its old line, and why (§146.5).
    const written = await db.withUser(identity, (tx) => tx.selectFrom('resume_versions').select('id').where('generation_id', '=', run.generationId).executeTakeFirstOrThrow());
    const changes = await getVersionChanges(db, identity, generation.resumeId!, written.id);
    expect(changes.find((change) => change.text === line.text)).toMatchObject({
      kind: 'reworded',
      before: BASE.roles[0]!.bullets[0]!.text,
      why: 'Reworded for this job, from your own line.',
    });
    expect(generation.tailor?.changes).toEqual(expect.arrayContaining([{ label: 'Put Kubernetes into Backend Engineer · Lumen Pay — check it’s where you used it', left: false }]));
  });
});
