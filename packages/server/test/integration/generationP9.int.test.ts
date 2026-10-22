import { canonicalResumeSchema } from '@nextkin/shared/schemas/resumeContent';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { fabricatingModel, groundedModel, stubbornModel } from '../../evals/referenceModel';
import { createMemoryKv } from '../../src/cache/kv';
import { loadConfig } from '../../src/config';
import { createDatabase, type Database } from '../../src/db/database';
import type { RunnerHooks } from '../../src/pipeline/runner';
import { runKbCandidates } from '../../src/services/kbCandidates';
import { generationResult } from '../../src/services/documents';
import * as generations from '../../src/services/generations';
import { updateJd } from '../../src/services/jd';
import { getProfile } from '../../src/services/profile';
import { backendUser, counted, JD_TEXT, readyJd, runToEnd } from './fixtures/documents';
import { createUser, deleteUsers, fakeGateway, log } from './fixtures/pipeline';

/**
 * Generation end to end against Postgres (ImBackendImplementationPlan P9-01 to P9-07): JD intake
 * with verified spans and the 30-day cache, the resume pipeline with its claim ledger, bounded
 * revision and stripping, the other kinds, inline skill warnings and the KB candidates job. The
 * model is scripted (`evals/referenceModel.ts`); the golden set's live run measures model quality.
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

const rows = (userId: string, generationId: string) =>
  db.withUser({ userId, role: 'user' }, async (tx) => ({
    gen: await tx.selectFrom('generations').selectAll().where('id', '=', generationId).executeTakeFirstOrThrow(),
    versions: await tx.selectFrom('resume_versions').selectAll().where('generation_id', '=', generationId).execute(),
    reports: await tx.selectFrom('ats_reports').selectAll().where('generation_id', '=', generationId).execute(),
  }));

describe('JD intake (P9-01)', () => {
  it('keeps only requirements quoted from the text, and counts what it dropped', async () => {
    const userId = await backendUser(db, users);
    const jd = await readyJd(db, userId, groundedModel);
    expect(jd.status).toBe('ready');
    expect(jd.title).toBe('Senior Backend Engineer');
    expect(jd.company).toBe('Acme Payments');
    expect(jd.requiredSkills).toEqual(expect.arrayContaining(['Go', 'PostgreSQL', 'Kubernetes']));
    expect(jd.preferredSkills).toEqual(expect.arrayContaining(['Terraform', 'Redis']));
    // "Blockchain" came with a quote the text does not contain: dropped, and counted.
    expect([...jd.requiredSkills, ...jd.preferredSkills]).not.toContain('Blockchain');
    expect(jd.extraction?.dropped).toBe(1);
    const go = jd.requirements?.find((r) => r.id === 'req:go');
    expect(go?.span && JD_TEXT.slice(go.span.start, go.span.end)).toBe('Go');
  });

  it('pasting the same JD twice makes one model call', async () => {
    const userId = await backendUser(db, users);
    const { script, calls } = counted(groundedModel);
    const cache = createMemoryKv();
    await readyJd(db, userId, script, cache);
    await readyJd(db, userId, script, cache);
    expect(calls.job_description).toBe(1);
  });

  it('what the user corrects is what generation reads', async () => {
    const userId = await backendUser(db, users);
    const jd = await readyJd(db, userId, groundedModel);
    const edited = await updateJd(db, { userId, role: 'user' }, jd.id, { title: 'Staff Engineer', preferredSkills: ['Terraform'] });
    expect(edited.title).toBe('Staff Engineer');
    expect(edited.preferredSkills).toEqual(['Terraform']);
    expect(edited.requirements?.some((r) => r.id === 'req:redis')).toBe(false);
  });
});

describe('the resume pipeline (P9-02 to P9-04)', () => {
  it('builds a grounded resume: every claim cites a fact, the ledger is clean, the score is the engine’s', async () => {
    const userId = await backendUser(db, users);
    const jd = await readyJd(db, userId, groundedModel);
    const run = await runToEnd(db, userId, 'resume', { jdId: jd.id, origin: 'build' }, groundedModel);
    expect(run.outcome).toBe('completed');
    const { gen, versions, reports } = await rows(userId, run.generationId);
    expect(gen.status).toBe('ready');
    expect(versions).toHaveLength(1);
    const content = canonicalResumeSchema.parse(versions[0]!.content);
    for (const claim of [content.summary!, ...content.roles.flatMap((r) => r.bullets)]) expect(claim.evidence.length).toBeGreaterThan(0);
    expect((versions[0]!.claim_ledger as { untraceableHardFacts: number }).untraceableHardFacts).toBe(0);
    expect(versions[0]!.timeline_validation_result).toBeTruthy();
    expect(reports).toHaveLength(1);
    expect(reports[0]!.has_jd).toBe(true);
    // The 2012 role's Kubernetes tag is outside its era: the pre-filter kept it out of that role.
    const shop = content.roles.find((r) => r.company === 'Cartwheel')!;
    expect(shop.bullets.map((b) => b.text).join(' ')).not.toMatch(/Kubernetes/);

    const result = await generationResult(db, { userId, role: 'user' }, run.generationId);
    expect(result.content.kind).toBe('resume');
    expect(result.resume.atsScore).toBe(result.score?.total);
    expect(result.score?.report?.provenance.rubric).toBe('rubric-2');
  });

  it('repairs fabricated claims with a bounded revision', async () => {
    const userId = await backendUser(db, users);
    const jd = await readyJd(db, userId, groundedModel);
    const { script, calls } = counted(fabricatingModel);
    const run = await runToEnd(db, userId, 'resume', { jdId: jd.id }, script);
    expect(run.outcome).toBe('completed');
    expect(calls.revision).toBeGreaterThanOrEqual(1);
    const { versions, gen } = await rows(userId, run.generationId);
    expect((versions[0]!.claim_ledger as { counts: { violations: number } }).counts.violations).toBe(0);
    const text = JSON.stringify(versions[0]!.content);
    expect(text).not.toMatch(/Kafka|37 hours/);
    expect((gen.checkpoint as { outputs: { validate: { revisions: number } } }).outputs.validate.revisions).toBeGreaterThanOrEqual(1);
  });

  it('strips what is still invented after the revisions, leaving zero untraceable hard facts', async () => {
    const userId = await backendUser(db, users);
    const jd = await readyJd(db, userId, groundedModel);
    const { script, calls } = counted(stubbornModel);
    const run = await runToEnd(db, userId, 'resume', { jdId: jd.id }, script);
    expect(run.outcome).toBe('completed');
    expect(calls.revision).toBe(2);
    const { versions, gen } = await rows(userId, run.generationId);
    const validate = (gen.checkpoint as { outputs: { validate: { stripped: unknown[] } } }).outputs.validate;
    expect(validate.stripped.length).toBeGreaterThan(0);
    expect((versions[0]!.claim_ledger as { untraceableHardFacts: number }).untraceableHardFacts).toBe(0);
    expect(JSON.stringify(versions[0]!.content)).not.toMatch(/900 clients|Kafka/);
  });

  it('a stage can be retried on its own: a crash after validate resumes at score, writing one version', async () => {
    const userId = await backendUser(db, users);
    const jd = await readyJd(db, userId, groundedModel);
    let crashed = false;
    const hooks: RunnerHooks = {
      afterCommit(boundary) {
        if (boundary === 'after:validate' && !crashed) {
          crashed = true;
          throw new Error('crash after validate');
        }
      },
    };
    const { script, calls } = counted(groundedModel);
    const run = await runToEnd(db, userId, 'resume', { jdId: jd.id }, script, hooks);
    expect(crashed).toBe(true);
    expect(run.outcome).toBe('completed');
    expect(calls.resume).toBe(1); // generate was not re-run
    const { versions, reports } = await rows(userId, run.generationId);
    expect(versions).toHaveLength(1);
    expect(reports).toHaveLength(1);
  });

  it('queues a technology the KB cannot verify, and the KB job files a sourced candidate', async () => {
    // The queue and the KB outlive a run: start from a clean "CRM".
    // Only a curator or an admin may remove a KB row (the system role can only add candidates), and
    // the system role never deletes from the queue: a re-run resets the item to pending.
    await db.withUser({ userId: users[0] ?? '00000000-0000-7000-8000-000000000000', role: 'admin' }, (tx) => tx.deleteFrom('technologies').where('slug', '=', 'crm').execute());
    await db.withSystem('test: reset the CRM candidate', (tx) => tx.updateTable('kb_review_queue').set({ status: 'pending', technology_id: null, processed_at: null }).where('name_key', '=', 'crm').execute());
    const userId = await backendUser(db, users);
    await runToEnd(db, userId, 'resume', {}, groundedModel);
    const queued = await db.withSystem('test: read the queue', (tx) => tx.selectFrom('kb_review_queue').selectAll().where('name_key', '=', 'crm').executeTakeFirst());
    expect(queued?.status).toBe('pending');
    await runKbCandidates({ db, gateway: fakeGateway(db, groundedModel), log, batch: 50 });
    const filed = await db.withSystem('test: read the candidate', (tx) =>
      tx.selectFrom('kb_review_queue as q').innerJoin('technologies as t', 't.id', 'q.technology_id').select(['q.status', 't.review_status', 't.source_citation']).where('q.name_key', '=', 'crm').executeTakeFirst(),
    );
    expect(filed).toMatchObject({ status: 'seeded', review_status: 'llm_seeded' });
    expect(filed?.source_citation).toMatch(/^https:\/\//);
  });
});

describe('the other kinds (P9-03)', () => {
  it('zero_resume: every claim assumed, figures as placeholders, no score', async () => {
    const userId = await createUser(db, users);
    const run = await runToEnd(db, userId, 'zero_resume', { zero: { fullName: 'Test Person', yearsExperience: 5, targetTitle: 'Product Designer' } }, groundedModel);
    expect(run.outcome).toBe('completed');
    const { versions, reports } = await rows(userId, run.generationId);
    const content = canonicalResumeSchema.parse(versions[0]!.content);
    expect([content.summary!, ...content.roles.flatMap((r) => r.bullets)].every((c) => c.origin === 'assumed')).toBe(true);
    expect(JSON.stringify(content)).not.toMatch(/20%|4 squads/);
    expect(JSON.stringify(content)).toContain('[N]');
    expect(JSON.stringify(content)).not.toContain('Test Person');
    expect(reports).toHaveLength(0);
    const result = await generationResult(db, { userId, role: 'user' }, run.generationId);
    expect(result.resume.needsReview).toBe(true);
    expect(result.score).toBeUndefined();
  });

  it('cover_letter and ats_check run from a resume the server wrote', async () => {
    const userId = await backendUser(db, users);
    const jd = await readyJd(db, userId, groundedModel);
    const base = await runToEnd(db, userId, 'resume', { jdId: jd.id }, groundedModel);
    const letter = await runToEnd(db, userId, 'cover_letter', { jdId: jd.id, sourceResumeId: base.resumeId, tone: 'concise' }, groundedModel);
    expect(letter.outcome).toBe('completed');
    const cover = await generationResult(db, { userId, role: 'user' }, letter.generationId);
    expect(cover.content.kind).toBe('cover_letter');
    expect(cover.content.kind === 'cover_letter' && cover.content.paragraphs.length).toBeGreaterThan(0);

    const check = await runToEnd(db, userId, 'ats_check', { jdId: jd.id, sourceResumeId: base.resumeId }, groundedModel);
    expect(check.outcome).toBe('completed');
    const snapshot = await generations.getGeneration(db, { userId, role: 'user' }, check.generationId);
    expect(snapshot.atsCheck?.score).toBeGreaterThan(0);
    const { reports } = await rows(userId, check.generationId);
    expect(reports).toHaveLength(1);
  });
});

describe('inline skill validation (P9-05)', () => {
  it('warns about a skill tagged outside its role’s era, and still saves', async () => {
    const userId = await backendUser(db, users);
    const { profile } = await getProfile(db, { userId, role: 'user' });
    const warning = profile.skillWarnings?.find((w) => w.skill === 'Kubernetes');
    // The starter KB is machine-generated, so the most it can say is "suspect" (§7.7).
    expect(warning).toMatchObject({ verdict: 'suspect' });
    expect(profile.experiences.find((e) => e.company === 'Cartwheel')?.skills).toContain('Kubernetes');
  });
});
