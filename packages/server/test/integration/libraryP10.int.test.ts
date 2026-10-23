import type { ContentRole, ResumeContent } from '@nextkin/shared/models/resumeContent';
import { canonicalLetterSchema, canonicalResumeSchema } from '@nextkin/shared/schemas/resumeContent';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { groundedModel } from '../../evals/referenceModel';
import { loadConfig } from '../../src/config';
import { createDatabase, type Database } from '../../src/db/database';
import { createRunner } from '../../src/pipeline/runner';
import * as generations from '../../src/services/generations';
import { getProfile } from '../../src/services/profile';
import * as content from '../../src/services/resumeContent';
import * as read from '../../src/services/resumeRead';
import * as library from '../../src/services/resumes';
import { startSectionRun } from '../../src/services/sectionRuns';
import { backendUser, readyJd, runToEnd } from './fixtures/documents';
import { capturingPublisher, createUser, deleteUsers, fakeGateway, key, log } from './fixtures/pipeline';

/**
 * The library against Postgres (ImBackendImplementationPlan P10-01, P10-02, P10-09, P10-10): immutable
 * versions and restore, hand edits that keep evidence and re-score, the plan's version cap, typed
 * fixes, section regeneration, cover letters held to their source resume, and the Zero Resume
 * review through to the profile.
 */
const config = loadConfig();
let db: Database;
const users: string[] = [];
const as = (userId: string) => ({ userId, role: 'user' as const });

beforeAll(() => {
  db = createDatabase({ appUrl: config.DATABASE_URL, maintenanceUrl: config.DATABASE_MAINTENANCE_URL, poolMax: 6 });
});
afterAll(async () => {
  await deleteUsers(db, users);
  await db.destroy();
});

async function generated(plan: 'free' | 'pro' = 'free') {
  const userId = await backendUser(db, users);
  if (plan === 'pro') {
    await db.withUser(as(userId), async (tx) => {
      const account = await tx.insertInto('billing_accounts').values({ owner_user_id: userId }).returning('id').executeTakeFirstOrThrow();
      await tx.insertInto('subscriptions').values({ billing_account_id: account.id, user_id: userId, plan_id: 'pro_monthly', status: 'active' }).execute();
    });
  }
  const jd = await readyJd(db, userId, groundedModel);
  const run = await runToEnd(db, userId, 'resume', { jdId: jd.id, origin: 'build' }, groundedModel);
  return { userId, resumeId: run.resumeId!, jdId: jd.id };
}

const versionRows = (userId: string, resumeId: string) =>
  db.withUser(as(userId), (tx) => tx.selectFrom('resume_versions').selectAll().where('resume_id', '=', resumeId).orderBy('version_number').execute());

describe('versions and restore (P10-01)', () => {
  it('an edit is a new version that keeps untouched claims, records its checks and re-scores in under 10 s', async () => {
    const { userId, resumeId } = await generated();
    const before = (await read.getContent(db, as(userId), resumeId)) as ResumeContent;
    const role = before.experience[0]!;
    const started = Date.now();
    await content.updateSection(db, as(userId), resumeId, 'experience', [{ ...role, bullets: [role.bullets[0]!, 'Mentored four engineers through their first on-call rotation.'] }, ...before.experience.slice(1)]);
    expect(Date.now() - started).toBeLessThan(10_000);

    const versions = await versionRows(userId, resumeId);
    expect(versions.map((v) => v.version_number)).toEqual([1, 2]);
    const [first, second] = versions.map((v) => canonicalResumeSchema.parse(v.content));
    expect(second!.roles[0]!.bullets[0]).toEqual(first!.roles[0]!.bullets[0]);
    expect(second!.roles[0]!.bullets[1]).toMatchObject({ origin: 'user', evidence: [] });
    expect(versions[1]).toMatchObject({ created_by: 'user', change_note: 'Edited Experience' });
    expect(versions[1]!.claim_ledger).not.toBeNull();
    expect(versions[1]!.timeline_validation_result).not.toBeNull();
    const reports = await db.withUser(as(userId), (tx) => tx.selectFrom('ats_reports').select(['resume_version_id', 'generation_id']).where('resume_version_id', '=', versions[1]!.id).execute());
    expect(reports).toEqual([{ resume_version_id: versions[1]!.id, generation_id: null }]);
  });

  it('restoring writes version n+1 with the old body; the history, including the replaced version, stays', async () => {
    const { userId, resumeId } = await generated();
    await content.updateSection(db, as(userId), resumeId, 'summary', 'A shorter summary the user wrote.');
    const [v1, v2] = await versionRows(userId, resumeId);
    const restored = await content.restoreVersion(db, as(userId), resumeId, v1!.id);
    const after = await versionRows(userId, resumeId);
    expect(after.map((v) => v.id).slice(0, 2)).toEqual([v1!.id, v2!.id]);
    expect(after[2]).toMatchObject({ version_number: 3, created_by: 'restore', change_note: 'Restored v1', content_hash: v1!.content_hash });
    expect(restored).toMatchObject({ currentVersionId: after[2]!.id, versionCount: 3 });
  });

  it('a stale If-Match is refused (412) and nothing is written', async () => {
    const { userId, resumeId } = await generated();
    await expect(content.updateSection(db, as(userId), resumeId, 'summary', 'x y z', '"v0"')).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    expect(await versionRows(userId, resumeId)).toHaveLength(1);
  });

  it('Free sees the last 3 versions; older ones are locked, not deleted, and restoring one needs Pro', async () => {
    const free = await generated();
    for (const text of ['one', 'two', 'three', 'four']) await content.updateSection(db, as(free.userId), free.resumeId, 'summary', `Summary ${text}.`);
    const list = await read.getVersions(db, as(free.userId), free.resumeId);
    expect(list).toHaveLength(5);
    expect(list.map((v) => v.locked ?? false)).toEqual([false, false, false, true, true]);
    await expect(content.restoreVersion(db, as(free.userId), free.resumeId, list[4]!.id)).rejects.toMatchObject({ code: 'PLAN_LOCKED' });

    const pro = await generated('pro');
    for (const text of ['one', 'two', 'three', 'four']) await content.updateSection(db, as(pro.userId), pro.resumeId, 'summary', `Summary ${text}.`);
    expect((await read.getVersions(db, as(pro.userId), pro.resumeId)).some((v) => v.locked)).toBe(false);
  });
});

describe('library operations (P10-01, P10-02)', () => {
  it('duplicate is an independent resume at version 1, scored like its original', async () => {
    const { userId, resumeId } = await generated();
    const copy = await library.duplicateDocument(db, as(userId), resumeId);
    expect(copy).toMatchObject({ title: expect.stringMatching(/\(copy\)$/), versionCount: 1 });
    expect(copy.atsScore).toBeDefined();
    await content.updateSection(db, as(userId), copy.id, 'summary', 'Only the copy says this.');
    expect(((await read.getContent(db, as(userId), resumeId)) as ResumeContent).summary).not.toBe('Only the copy says this.');
  });

  it('create, rename and set as base: one base at a time', async () => {
    const { userId, resumeId } = await generated();
    const blank = await library.createDocument(db, as(userId), { title: 'From scratch', docType: 'resume' });
    expect(blank).toMatchObject({ versionCount: 1, status: 'ready' });
    await expect(read.getScore(db, as(userId), blank.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect((await library.renameDocument(db, as(userId), blank.id, '  Renamed  ')).title).toBe('Renamed');
    await library.setAsBase(db, as(userId), resumeId);
    const list = await library.setAsBase(db, as(userId), blank.id);
    expect(list.filter((r) => r.isBase).map((r) => r.id)).toEqual([blank.id]);
  });

  it('applies a typed fix for a skill the profile backs, and refuses anything else', async () => {
    const { userId, resumeId } = await generated();
    const before = (await read.getContent(db, as(userId), resumeId)) as ResumeContent;
    // Take Kubernetes off the page: the JD requires it and the profile backs it, so a fix appears.
    await content.updateSection(db, as(userId), resumeId, 'skills', before.skills.filter((s) => s !== 'Kubernetes'));
    await content.updateSection(db, as(userId), resumeId, 'experience', before.experience.map((r) => ({ ...r, skills: (r.skills ?? []).filter((s) => s !== 'Kubernetes'), bullets: r.bullets.filter((b) => !/kubernetes/i.test(b)) })));
    const panel = await read.getScore(db, as(userId), resumeId);
    const fixes = panel.report?.fixes ?? [];
    const item = panel.sections.flatMap((s) => s.items).find((i) => i.fixId && fixes.find((f) => f.id === i.fixId)?.type === 'surface_backed_skill');
    expect(item).toBeDefined();
    const { content: next } = await content.applyAtsFix(db, as(userId), resumeId, item!.id);
    const after = next as ResumeContent;
    expect([...after.skills, ...after.experience.flatMap((r) => r.skills ?? [])].some((s) => /kubernetes/i.test(s))).toBe(true);
    await expect(content.applyAtsFix(db, as(userId), resumeId, 'not-an-item')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('regenerating one section runs on the worker, replaces only that section, and stays out of the run list', async () => {
    const { userId, resumeId } = await generated();
    await content.updateSection(db, as(userId), resumeId, 'summary', 'The user’s own summary stays.');
    const run = await startSectionRun(db, as(userId), resumeId, 'experience', { idempotencyKey: key(), correlationId: null });
    const outcome = await createRunner({ db, gateway: fakeGateway(db, groundedModel), publisher: capturingPublisher(), log }).run({ generationId: run.id, userId, correlationId: null, receiveCount: 1 });
    expect(outcome).toBe('completed');
    const after = (await read.getContent(db, as(userId), resumeId)) as ResumeContent;
    expect(after.summary).toBe('The user’s own summary stays.');
    const versions = await versionRows(userId, resumeId);
    expect(versions.at(-1)).toMatchObject({ created_by: 'generation', change_note: 'Regenerated Experience', generation_id: run.id });
    expect((await generations.listGenerations(db, as(userId))).some((g) => g.id === run.id)).toBe(false);
  });
});

describe('cover letters (P10-09)', () => {
  it('a letter draws only on facts its source resume shows; an edit is a new version', async () => {
    const { userId, resumeId, jdId } = await generated();
    const before = (await read.getContent(db, as(userId), resumeId)) as ResumeContent;
    // Leave the older role off the resume: its facts must not reach the letter.
    await content.updateSection(db, as(userId), resumeId, 'experience', before.experience.slice(0, 1) as ContentRole[]);
    const source = canonicalResumeSchema.parse((await versionRows(userId, resumeId)).at(-1)!.content);
    const cited = new Set(source.roles.flatMap((r) => [r.roleId, ...r.bullets.flatMap((b) => b.evidence)]));
    const run = await runToEnd(db, userId, 'cover_letter', { sourceResumeId: resumeId, jdId, tone: 'confident' }, groundedModel);
    expect(run.outcome).toBe('completed');
    const letterId = run.resumeId!;
    const [letterVersion] = await versionRows(userId, letterId);
    const letter = canonicalLetterSchema.parse(letterVersion!.content);
    expect(letter.tone).toBe('confident');
    for (const p of letter.paragraphs) for (const id of p.evidence) expect(cited.has(id) || cited.has(id.split('#')[0]!)).toBe(true);

    await content.updateLetter(db, as(userId), letterId, { greeting: 'Dear hiring team,' });
    const versions = await versionRows(userId, letterId);
    expect(versions).toHaveLength(2);
    expect(((await read.getContent(db, as(userId), letterId)) as { greeting: string; resumeId: string })).toMatchObject({ greeting: 'Dear hiring team,', resumeId });
  });
});

describe('Zero Resume review (P10-10)', () => {
  it('answers each guess as a version, and the last one fills the profile', async () => {
    const userId = await createUser(db, users);
    const jd = await readyJd(db, userId, groundedModel);
    const run = await runToEnd(db, userId, 'zero_resume', { jdId: jd.id, zero: { fullName: 'Sam Example', yearsExperience: 4 } }, groundedModel);
    const resumeId = run.resumeId!;
    let draft = (await read.getContent(db, as(userId), resumeId)) as ResumeContent;
    expect(draft.review!.total).toBeGreaterThan(0);
    expect((await read.getResume(db, as(userId), resumeId)).needsReview).toBe(true);

    await expect(content.resolveZeroCheck(db, as(userId), resumeId, { kind: 'role', roleId: draft.experience[0]!.id, title: 'Analyst', company: '[Company Name]', start: { year: 2021 }, end: 'present' })).rejects.toMatchObject({ code: 'ZERO_BLANK', message: "Add the real company — a blank can't stay." });

    let finished = false;
    for (const role of draft.experience) ({ finished } = await content.resolveZeroCheck(db, as(userId), resumeId, { kind: 'role', roleId: role.id, title: role.title, company: 'Northwind Analytics', start: { year: 2021, month: 1 }, end: 'present' }));
    for (const skill of draft.review!.pendingSkills) ({ finished } = await content.resolveZeroCheck(db, as(userId), resumeId, { kind: 'skill', skill, name: skill }));
    draft = (await read.getContent(db, as(userId), resumeId)) as ResumeContent;
    for (const entry of draft.education) ({ finished } = await content.resolveZeroCheck(db, as(userId), resumeId, { kind: 'education', entryId: entry.id, degree: 'BA Economics', institution: 'University of Leeds', start: { year: 2015 }, end: { year: 2018 } }));
    expect(finished).toBe(true);
    expect((await read.getResume(db, as(userId), resumeId)).needsReview).toBeUndefined();
    const { profile } = await getProfile(db, as(userId));
    expect(profile.experiences.some((e) => e.company === 'Northwind Analytics')).toBe(true);
    expect(profile.education.some((e) => e.institution === 'University of Leeds')).toBe(true);
  });
});
