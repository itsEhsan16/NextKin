import { CANONICAL_SCHEMA_VERSION, canonicalResumeSchema, type CanonicalResumeJson } from '@nextkin/shared/schemas/resumeContent';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { groundedModel } from '../../evals/referenceModel';
import type { FakeScript } from '../../src/ai/providers/fake';
import { loadConfig } from '../../src/config';
import { createDatabase, type Database } from '../../src/db/database';
import type { LatexCompiler } from '../../src/export/latex/compile';
import type { RunnerHooks } from '../../src/pipeline/runner';
import * as generations from '../../src/services/generations';
import { compareResumeToJd } from '../../src/services/tailorCompare';
import { insertVersion } from '../../src/services/versions';
import { backendUser, counted, readyJd, runToEnd } from './fixtures/documents';
import { createUser, deleteUsers } from './fixtures/pipeline';

/**
 * A tailored run end to end against Postgres (toreview §110.3): the run starts from one of the
 * user's resumes, its baseline is W-TAILOR 01's number, the parts switched off come back word for
 * word, the ticked keyword is listed and on the profile, the unticked ones appear nowhere, and the
 * ready screen's score and changes come from the saved version. The model is scripted
 * (`evals/referenceModel.ts`); the resume is synthetic (L4).
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

/** Mentions Go and PostgreSQL; the JD (`JD_TEXT`) also asks for Kubernetes, Terraform and Redis. */
const BASE: CanonicalResumeJson = {
  schemaVersion: CANONICAL_SCHEMA_VERSION,
  headline: 'Backend engineer',
  summary: line('s0', 'Backend engineer working on payment systems.'),
  skills: ['Python', 'Go', 'PostgreSQL'].map((name, i) => ({ id: `k${i}`, name, evidence: [], origin: 'user' as const })),
  roles: [
    { roleId: 'pay', company: 'Lumen Pay', title: 'Senior Backend Engineer', start: '2020-03', end: null, skills: ['Go', 'PostgreSQL'], bullets: [line('a', 'Built the settlement service in Go, processing 2 million transactions daily'), line('b', 'Reworked PostgreSQL indexes for the ledger API')] },
    { roleId: 'mid', company: 'Northwind Retail', title: 'Backend Developer', start: '2013-01', end: '2019-12', skills: ['Go'], bullets: [line('c', 'Wrote the stock service in Go')] },
    { roleId: 'shop', company: 'Cartwheel', title: 'Junior Developer', start: '2009-01', end: '2012-06', skills: ['Python'], bullets: [line('d', 'Developed order APIs in Python for 300 merchants')] },
    { roleId: 'old', company: 'Corner Shop', title: 'Assistant', start: null, end: null, skills: [], bullets: [line('e', 'Kept the stock list up to date')] },
  ],
  education: [{ factId: 'edu', institution: 'TU Example', degree: 'BSc Computer Science', start: null, end: null }],
  certifications: [],
  projects: [],
};

async function baseResume(userId: string): Promise<string> {
  return db.withUser({ userId, role: 'user' }, async (tx) => {
    const resume = await tx.insertInto('resumes').values({ user_id: userId, title: 'My resume', doc_type: 'resume', source: 'uploaded', is_base: true }).returning('id').executeTakeFirstOrThrow();
    await insertVersion(tx, { userId, resumeId: resume.id, content: BASE, note: 'Uploaded', createdBy: 'user' });
    return resume.id;
  });
}

const tailoring = { fixes: ['headline', 'skills', 'experience'], experience: 'quick', keywords: ['Terraform'] } as const;

/** A model that slips the keywords the user left out into everything it writes. */
const pushy: FakeScript = (request, n) => {
  const answer = groundedModel(request, n);
  if (request.output?.name !== 'resume' || !answer || !('data' in answer)) return answer;
  const draft = answer.data as { summary: { text: string } | null; roles: { bullets: { text: string }[] }[] };
  return {
    ...answer,
    data: {
      ...draft,
      summary: draft.summary ? { ...draft.summary, text: `${draft.summary.text} Runs Kubernetes and Redis.` } : null,
      roles: draft.roles.map((r) => ({ ...r, bullets: r.bullets.map((b) => ({ ...b, text: `${b.text} on Kubernetes with Redis` })) })),
    },
  };
};

const allText = (doc: CanonicalResumeJson) => JSON.stringify([doc.headline, doc.summary?.text, doc.skills.map((s) => s.name), doc.roles.map((r) => r.bullets.map((b) => b.text))]);

describe('a tailored run (toreview §110.3)', () => {
  it('builds from the picked resume: the baseline is the comparison’s, what was off is verbatim, the tick is in', async () => {
    const userId = await backendUser(db, users);
    const identity = { userId, role: 'user' as const };
    const jd = await readyJd(db, userId, groundedModel);
    const resumeId = await baseResume(userId);
    const comparison = await compareResumeToJd(db, identity, jd.id, resumeId);
    expect(comparison.keywords.filter((k) => !k.onResume).map((k) => k.label)).toEqual(expect.arrayContaining(['Kubernetes', 'Terraform', 'Redis']));

    const run = await runToEnd(db, userId, 'resume', { jdId: jd.id, baseResumeId: resumeId, tailoring }, groundedModel);
    expect(run.outcome).toBe('completed');
    const generation = await generations.getGeneration(db, identity, run.generationId);
    expect(generation.status).toBe('ready');
    expect(generation.tailor).toMatchObject({ sourceResumeId: resumeId, baselineScore: comparison.score, added: ['Terraform'], fixes: [...tailoring.fixes], experience: 'quick' });
    expect(generation.tailor?.skipped).toEqual(expect.arrayContaining(['Kubernetes', 'Redis']));
    expect(generation.tailor?.skipped).not.toContain('Terraform');

    const saved = await db.withUser(identity, async (tx) => ({
      version: await tx.selectFrom('resume_versions').selectAll().where('generation_id', '=', run.generationId).executeTakeFirstOrThrow(),
      report: await tx.selectFrom('ats_reports').selectAll().where('generation_id', '=', run.generationId).executeTakeFirstOrThrow(),
      skills: await tx.selectFrom('profile_skills').select('raw_name').where('user_id', '=', userId).execute(),
      base: await tx.selectFrom('resume_versions').select('id').where('resume_id', '=', resumeId).execute(),
    }));
    const doc = canonicalResumeSchema.parse(saved.version.content);
    // Summary off: the base's. Undated and older roles: the base's. Headers: the base's.
    expect(doc.summary?.text).toBe(BASE.summary?.text);
    expect(doc.roles.find((r) => r.roleId === 'shop')?.bullets.map((b) => b.text)).toEqual(['Developed order APIs in Python for 300 merchants']);
    expect(doc.roles.find((r) => r.roleId === 'old')?.bullets.map((b) => b.text)).toEqual(['Kept the stock list up to date']);
    expect(doc.roles.map((r) => [r.company, r.title, r.start, r.end])).toEqual(BASE.roles.map((r) => [r.company, r.title, r.start, r.end]));
    expect(doc.headline).toBe('Senior Backend Engineer');
    expect(doc.skills.map((s) => s.name)).toEqual(['Go', 'PostgreSQL', 'Terraform', 'Python']);
    expect(allText(doc)).not.toMatch(/Kubernetes|Redis/);
    // The tick is on the profile too; the base resume gained no version.
    expect(saved.skills.map((s) => s.raw_name)).toContain('Terraform');
    expect(saved.base).toHaveLength(1);
    // The ready screen's numbers are the saved version's.
    expect(generation.tailor?.score).toBe(Number(saved.report.total_bps) / 100);
    expect((saved.version.claim_ledger as { basis?: unknown }).basis).toEqual({ kind: 'document', versionId: saved.base[0]!.id });
    expect(generation.tailor?.changes).toEqual(
      expect.arrayContaining([
        { label: 'Headline aimed at Senior Backend Engineer', left: false },
        { label: 'Added Terraform, as you chose', left: false },
        { label: 'The skills this job asks for listed first', left: false },
      ]),
    );
    expect(generation.tailor?.changes?.find((c) => c.left)?.label).toMatch(/Kubernetes and Redis left out|Redis and Kubernetes left out/);
  });

  it('a keyword the user left out never reaches the document, however hard the model pushes it', async () => {
    const userId = await backendUser(db, users);
    const jd = await readyJd(db, userId, groundedModel);
    const resumeId = await baseResume(userId);
    const { script, calls } = counted(pushy);
    const run = await runToEnd(db, userId, 'resume', { jdId: jd.id, baseResumeId: resumeId, tailoring: { ...tailoring, fixes: ['summary', 'experience'], experience: 'full' } }, script);
    expect(run.outcome).toBe('completed');
    expect(calls.revision).toBeGreaterThanOrEqual(1);
    const version = await db.withUser({ userId, role: 'user' }, (tx) => tx.selectFrom('resume_versions').select('content').where('generation_id', '=', run.generationId).executeTakeFirstOrThrow());
    const doc = canonicalResumeSchema.parse(version.content);
    expect(allText(doc)).not.toMatch(/Kubernetes|Redis/);
    expect(doc.roles.find((r) => r.roleId === 'old')?.bullets.map((b) => b.text)).toEqual(['Kept the stock list up to date']);
  });

  it('a redelivered run merges into the same pinned version, once', async () => {
    const userId = await backendUser(db, users);
    const jd = await readyJd(db, userId, groundedModel);
    const resumeId = await baseResume(userId);
    let crashed = false;
    const hooks: RunnerHooks = {
      afterCommit(boundary) {
        if (boundary === 'after:generate' && !crashed) {
          crashed = true;
          throw new Error('crash after generate');
        }
      },
    };
    const { script, calls } = counted(groundedModel);
    const run = await runToEnd(db, userId, 'resume', { jdId: jd.id, baseResumeId: resumeId, tailoring }, script, hooks);
    expect(crashed).toBe(true);
    expect(run.outcome).toBe('completed');
    expect(calls.resume).toBe(1); // generate was not re-run
    const versions = await db.withUser({ userId, role: 'user' }, (tx) => tx.selectFrom('resume_versions').select('content').where('generation_id', '=', run.generationId).execute());
    expect(versions).toHaveLength(1);
    expect(canonicalResumeSchema.parse(versions[0]!.content).summary?.text).toBe(BASE.summary?.text);
  });

  it('fits a fresher’s resume to one compiled page, dropping the lines that name nothing the job asks (§111.6)', async () => {
    const userId = await backendUser(db, users);
    const identity = { userId, role: 'user' as const };
    const jd = await readyJd(db, userId, groundedModel);
    const texts = ['Built the settlement service in Go', 'Ordered supplies for the team', 'Tuned PostgreSQL queries for reports', 'Ran the weekly demo', 'Answered support tickets', 'Kept the wiki tidy'];
    const fresher: CanonicalResumeJson = { ...BASE, roles: [{ roleId: 'now', company: 'Lumen Pay', title: 'Backend Engineer', start: '2024-02', end: null, skills: ['Go', 'PostgreSQL'], bullets: texts.map((t, i) => line(`n${i}`, t)) }] };
    const resumeId = await db.withUser(identity, async (tx) => {
      const resume = await tx.insertInto('resumes').values({ user_id: userId, title: 'My resume', doc_type: 'resume', source: 'uploaded', is_base: true }).returning('id').executeTakeFirstOrThrow();
      await insertVersion(tx, { userId, resumeId: resume.id, content: fresher, note: 'Uploaded', createdBy: 'user' });
      return resume.id;
    });
    // A stand-in for the compiler: two pages while more than three of the lines are printed.
    const sources: string[] = [];
    const latex: LatexCompiler = {
      async compile(tex) {
        sources.push(tex);
        const pages = texts.filter((t) => tex.includes(t)).length > 3 ? 2 : 1;
        return { pdf: new Uint8Array([37]), pages, pngs: [], ms: 1 };
      },
    };
    const run = await runToEnd(db, userId, 'resume', { jdId: jd.id, baseResumeId: resumeId, tailoring: { fixes: ['skills'], keywords: [] } }, groundedModel, undefined, { latex });
    expect(run.outcome).toBe('completed');
    // The run holds no contact (G5): the fit measures with a stand-in name and contact line.
    expect(sources.length).toBeGreaterThan(0);
    expect(sources.every((tex) => tex.includes('Your Name') && tex.includes('name@example.com'))).toBe(true);

    const generation = await generations.getGeneration(db, identity, run.generationId);
    expect(generation.tailor).toMatchObject({ pages: 1, pageBasis: expect.stringMatching(/^Fitted to 1 page: under 5 years/) });
    expect(generation.tailor?.changes).toEqual(expect.arrayContaining([{ label: 'Kept 3 of 6 bullets in Backend Engineer · Lumen Pay', left: false }]));
    const saved = await db.withUser(identity, async (tx) => ({
      version: await tx.selectFrom('resume_versions').select(['id', 'content']).where('generation_id', '=', run.generationId).executeTakeFirstOrThrow(),
      renders: await tx.selectFrom('resume_renders').select(['resume_version_id', 'density']).execute(),
    }));
    // The skill lines stay; the rest go from the bottom, never reworded.
    expect(canonicalResumeSchema.parse(saved.version.content).roles[0]!.bullets.map((b) => b.text)).toEqual([texts[0], texts[1], texts[2]]);
    expect(saved.renders.find((r) => r.resume_version_id === saved.version.id)).toMatchObject({ density: 0 });
    expect(sources.length).toBeLessThanOrEqual(10);
  });

  it('starts only from the user’s own resume and a JD that was read', async () => {
    const userId = await backendUser(db, users);
    const stranger = await createUser(db, users);
    const jd = await readyJd(db, userId, groundedModel);
    const theirs = await baseResume(stranger);
    const start = (input: Record<string, unknown>) =>
      generations.startGeneration(db, { userId, role: 'user' }, { kind: 'resume', ...input }, { idempotencyKey: crypto.randomUUID(), correlationId: null });
    await expect(start({ jdId: jd.id, baseResumeId: theirs, tailoring })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(start({ baseResumeId: theirs, tailoring })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    const none = await db.withUser({ userId, role: 'user' }, (tx) => tx.selectFrom('generations').select('id').where('user_id', '=', userId).execute());
    expect(none).toHaveLength(0);
  });
});
