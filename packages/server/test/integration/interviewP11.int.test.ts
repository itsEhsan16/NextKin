import { canonicalResumeSchema } from '@nextkin/shared/schemas/resumeContent';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { fabricatingModel, groundedModel } from '../../evals/referenceModel';
import { loadConfig } from '../../src/config';
import { createDatabase, type Database } from '../../src/db/database';
import { mentions } from '../../src/pipeline/stages/interview';
import { generationResult } from '../../src/services/documents';
import * as interview from '../../src/services/interview';
import { lockResume, writeResumeVersion } from '../../src/services/versions';
import { backendUser, counted, readyJd, runToEnd } from './fixtures/documents';
import { deleteUsers, grantPro } from './fixtures/pipeline';

/**
 * Interview practice sets end to end against Postgres (ImBackendImplementationPlan P11-08; V2
 * §7.15): technical questions only on skills the resume claims and the JD asks for, never on a
 * skill the timeline engine flagged or the resume does not back, whatever the model writes; the
 * standalone mode labelled generic; marks that persist; one set per run.
 */
const config = loadConfig();
let db: Database;
const users: string[] = [];

beforeAll(() => {
  db = createDatabase({ appUrl: config.DATABASE_URL, maintenanceUrl: config.DATABASE_MAINTENANCE_URL, poolMax: 6 });
});
afterAll(async () => {
  await deleteUsers(db, users);
  await db.destroy();
});

/** A built resume whose 2009–2012 role claims Kubernetes (released 2014): the timeline flags it. */
async function resumeWithFlaggedSkill() {
  const userId = await backendUser(db, users);
  const jd = await readyJd(db, userId, groundedModel);
  const built = await runToEnd(db, userId, 'resume', { jdId: jd.id, origin: 'build' }, groundedModel);
  const resumeId = built.resumeId!;
  await db.withUser({ userId, role: 'user' }, async (tx) => {
    const row = await lockResume(tx, resumeId);
    const version = await tx.selectFrom('resume_versions').select('content').where('id', '=', row.current_version_id!).executeTakeFirstOrThrow();
    const doc = canonicalResumeSchema.parse(version.content);
    const roles = doc.roles.map((r) => (r.company === 'Cartwheel' ? { ...r, skills: [...r.skills, 'Kubernetes'] } : r));
    await writeResumeVersion(tx, { userId, resumeId, jdId: row.job_description_id, doc: { ...doc, roles }, note: 'Claimed Kubernetes at Cartwheel', createdBy: 'user' });
  });
  return { userId, jd, resumeId };
}

const EXCLUDED = ['Kubernetes', 'Terraform', 'Redis'];
const textOf = (q: { prompt: string; answer: string; talkingPoints: string[] }) => [q.prompt, q.answer, ...q.talkingPoints].join(' ');

describe('interview sets (P11-08)', () => {
  it('writes technical questions only on eligible skills, from the resume’s own JD', async () => {
    const { userId, jd, resumeId } = await resumeWithFlaggedSkill();
    // No jdId given: the run reads the JD the resume was made for.
    const run = await runToEnd(db, userId, 'interview', { sourceResumeId: resumeId }, groundedModel);
    expect(run.outcome).toBe('completed');
    const set = (await interview.setByGeneration(db, { userId, role: 'user' }, run.generationId))!;
    expect(set).toMatchObject({ source: 'resume', resumeId, jdId: jd.id, company: 'Acme Payments', title: 'Acme Payments — Senior Backend Engineer' });
    expect(set.questions.length).toBeGreaterThanOrEqual(10);
    expect(set.questions.length).toBeLessThanOrEqual(20);
    const technical = set.questions.filter((q) => q.kind === 'technical');
    expect(technical.map((q) => q.skill).sort()).toEqual(['Go', 'PostgreSQL']);
    for (const q of set.questions) for (const skill of EXCLUDED) expect(mentions(textOf(q), skill)).toBe(false);

    const activity = await db.withUser({ userId, role: 'user' }, (tx) => tx.selectFrom('activity').selectAll().where('kind', '=', 'interview').execute());
    expect(activity).toHaveLength(1);
    expect(activity[0]!.deep_link).toBe(`/interview/${set.id}`);
    await expect(generationResult(db, { userId, role: 'user' }, run.generationId)).rejects.toMatchObject({ code: 'CONFLICT' });
  }, 60_000);

  it('drops what a fabricating model writes about flagged, unbacked or unclaimed skills', async () => {
    const { userId, resumeId } = await resumeWithFlaggedSkill();
    const { script, calls } = counted(fabricatingModel);
    const run = await runToEnd(db, userId, 'interview', { sourceResumeId: resumeId }, script);
    expect(run.outcome).toBe('completed');
    expect(calls.interview_set).toBe(1);
    const gen = await db.withUser({ userId, role: 'user' }, (tx) => tx.selectFrom('generations').select('checkpoint').where('id', '=', run.generationId).executeTakeFirstOrThrow());
    expect((gen.checkpoint as { outputs: { check: { dropped: number } } }).outputs.check.dropped).toBeGreaterThanOrEqual(EXCLUDED.length * 2 + 1);
    const set = (await interview.setByGeneration(db, { userId, role: 'user' }, run.generationId))!;
    for (const q of set.questions) {
      for (const skill of [...EXCLUDED, 'Cobol']) expect(mentions(textOf(q), skill)).toBe(false);
      if (q.kind === 'technical') expect(['Go', 'PostgreSQL']).toContain(q.skill);
    }
  }, 60_000);

  it('writes a standalone set from a role title, labelled generic, and links a regenerated one', async () => {
    const { userId } = await resumeWithFlaggedSkill();
    await grantPro(db, userId); // Free has one standalone set a month (P12-09)
    const first = await runToEnd(db, userId, 'interview', { title: 'Data Analyst' }, groundedModel);
    const second = await runToEnd(db, userId, 'interview', { title: 'Data Analyst' }, groundedModel);
    const identity = { userId, role: 'user' as const };
    const a = (await interview.setByGeneration(db, identity, first.generationId))!;
    const b = (await interview.setByGeneration(db, identity, second.generationId))!;
    expect(a).toMatchObject({ source: 'standalone', roleTitle: 'Data Analyst', title: 'Data Analyst' });
    expect(a.resumeId).toBeUndefined();
    expect(a.questions.every((q) => q.kind === 'behavioural' && q.skill === undefined)).toBe(true);
    expect(a.questions.length).toBeGreaterThanOrEqual(10);
    expect(b.regeneratedFromId).toBe(a.id);
    expect((await interview.listSets(db, identity)).map((s) => s.id)).toEqual([b.id, a.id]);
  }, 60_000);

  it('keeps marks atomically, resets them, and deletes one set', async () => {
    const { userId } = await resumeWithFlaggedSkill();
    const identity = { userId, role: 'user' as const };
    const run = await runToEnd(db, userId, 'interview', { title: 'Product Manager' }, groundedModel);
    const set = (await interview.setByGeneration(db, identity, run.generationId))!;
    const [q0, q1] = set.questions;
    // Two marks at once on different questions: both land.
    await Promise.all([interview.markQuestion(db, identity, set.id, q0!.id, 'confident'), interview.markQuestion(db, identity, set.id, q1!.id, 'needs_work')]);
    const marked = await interview.getSet(db, identity, set.id);
    expect(marked.questions.slice(0, 2).map((q) => q.mark)).toEqual(['confident', 'needs_work']);
    expect(marked.questions.map((q) => q.id)).toEqual(set.questions.map((q) => q.id));
    await expect(interview.markQuestion(db, identity, set.id, 'q_nope', 'confident')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect((await interview.resetMarks(db, identity, set.id)).questions.every((q) => q.mark === 'unmarked')).toBe(true);
    await interview.removeSet(db, identity, set.id);
    await expect(interview.getSet(db, identity, set.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(await interview.setByGeneration(db, identity, run.generationId)).toBeNull();
  }, 60_000);

  it('a run redelivered after its set was written writes no second set', async () => {
    const { userId, resumeId } = await resumeWithFlaggedSkill();
    let crashed = false;
    const run = await runToEnd(db, userId, 'interview', { sourceResumeId: resumeId }, groundedModel, {
      beforeCommit: (name) => {
        if (name === 'after:persist' && !crashed) {
          crashed = true;
          throw new Error('crash after the set was written');
        }
      },
    });
    expect(crashed).toBe(true);
    expect(run.outcome).toBe('completed');
    const sets = await db.withUser({ userId, role: 'user' }, (tx) => tx.selectFrom('interview_question_sets').select('id').where('generation_id', '=', run.generationId).execute());
    expect(sets).toHaveLength(1);
    const activity = await db.withUser({ userId, role: 'user' }, (tx) => tx.selectFrom('activity').select('id').where('kind', '=', 'interview').execute());
    expect(activity).toHaveLength(1);
  }, 60_000);
});
