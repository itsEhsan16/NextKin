import { sql } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { groundedModel } from '../../evals/referenceModel';
import { createAiGateway } from '../../src/ai/gateway';
import { createFakeProvider } from '../../src/ai/providers/fake';
import { createAiSettings } from '../../src/ai/routing';
import { createDbTrace } from '../../src/ai/trace';
import { loadConfig } from '../../src/config';
import { createValkeyPublisher } from '../../src/pipeline/events';
import { createGenerationHub, type GenerationHub } from '../../src/pipeline/hub';
import { dlqOf, QUEUES } from '../../src/queue/envelope';
import { createSqsQueue } from '../../src/queue/sqs';
import { buildWorker, type Worker } from '../../src/worker/build';
import { mobileLogin, registered, startHarness, type Harness } from './fixtures/authHarness';
import { log } from './fixtures/pipeline';

/**
 * P9-08's done-when, through the shared client both apps run: paste a JD → the server reads it →
 * Build Resume from the profile → the worker runs the real pipeline (the reference model in place of
 * Claude) → the finished document lands in the app's library, score and all. Runs that start from a
 * library document stay on the mock and never reach the server.
 */
const config = loadConfig();
let h: Harness;
let hub: GenerationHub;
let worker: Worker;
const queue = createSqsQueue({ region: config.AWS_REGION, endpoint: config.SQS_ENDPOINT, prefix: config.SQS_QUEUE_PREFIX });

beforeAll(async () => {
  h = await startHarness({
    generations: (valkey) => {
      hub = createGenerationHub(valkey, log);
      return { publisher: createValkeyPublisher(valkey), hub, heartbeatMs: 200, streamMs: 20_000 };
    },
  });
  worker = buildWorker({
    db: h.db,
    queue,
    gateway: createAiGateway({ settings: createAiSettings(h.db, 0), providers: { resolve: (f) => (f === 'claude' ? createFakeProvider({ script: groundedModel }) : null), isDeveloperKey: () => false }, trace: createDbTrace(h.db, log), log, developer: 'test', dailyCapUsd: 0, retryDelayMs: () => 0 }),
    publisher: createValkeyPublisher(h.valkey),
    log,
    concurrency: 4,
    generationTimeoutSeconds: 180,
    scheduler: false,
  });
  worker.start();
});
afterAll(async () => {
  await worker.stop(1000);
  await hub.close();
  queue.close();
  await h.close();
});
beforeEach(async () => {
  await h.db.withSystem('test: settle the outbox', (tx) => tx.updateTable('outbox').set({ published_at: sql`now()` }).where('published_at', 'is', null).execute());
  for (const name of [...QUEUES, ...QUEUES.map(dlqOf)]) await queue.purge!(name);
});

const JD = [
  'Senior Backend Engineer at Acme Payments',
  'We build reliable payment services for merchants across Europe.',
  'Requirements: strong Go and PostgreSQL skills, and experience running Kubernetes in production.',
  'Nice to have: Terraform and Redis.',
].join('\n');

describe('the apps’ HTTP repositories (P9-08)', () => {
  it('JD → Build Resume → the finished document, on the local backend', async () => {
    const { createRepos } = await import('@nextkin/shared/repos/create');
    const { createMockRepos } = await import('@nextkin/shared/repos');
    const { createMockStore } = await import('@nextkin/shared/repos/state');
    const { adoptDocument } = await import('@nextkin/shared/repos/adopt');
    const { createHttpClient } = await import('@nextkin/shared/repos/http/client');

    const email = await registered(h);
    const tokens = await mobileLogin(h, email);
    const user = await h.db.withSystem('test: find the user', (tx) => tx.selectFrom('users').select('id').where('email', '=', email).executeTakeFirstOrThrow());
    await h.db.withUser({ userId: user.id, role: 'user' }, async (tx) => {
      const role = await tx
        .insertInto('experience')
        .values({ user_id: user.id, company: 'Lumen Pay', title: 'Senior Backend Engineer', start_date: '2020-03-01', is_current: true, responsibilities: ['Built the settlement service in Go, processing 2 million transactions daily', 'Moved 40 services onto Kubernetes with zero downtime'] })
        .returning('id')
        .executeTakeFirstOrThrow();
      for (const raw of ['Go', 'Kubernetes']) await tx.insertInto('experience_skills').values({ user_id: user.id, experience_id: role.id, raw_name: raw }).execute();
      for (const raw of ['Go', 'Kubernetes']) await tx.insertInto('profile_skills').values({ user_id: user.id, raw_name: raw }).execute();
    });

    let stored = { ...tokens, expiresIn: 3600 };
    const http = createHttpClient({
      baseUrl: 'http://localhost:3000',
      client: 'mobile',
      tokens: { get: async () => stored, set: async (next) => void (next && (stored = next)) },
      fetch: (input, init) => h.app.request(String(input), init) as Promise<Response>,
    });
    const store = createMockStore();
    const { repos } = createRepos({ sources: { jd: 'http', generations: 'http', interview: 'http' }, http, adopt: (doc) => adoptDocument(store, doc) }, createMockRepos(store));

    // 1. The JD is read on the server, spans verified.
    const draft = await repos.jd.extract({ source: 'paste', text: JD });
    expect(draft.status).toBe('ready');
    expect(draft.requiredSkills).toEqual(expect.arrayContaining(['Go', 'PostgreSQL', 'Kubernetes']));
    const confirmed = await repos.jd.update(draft.id, { title: 'Senior Backend Engineer' });

    // 2. Build Resume from the profile runs on the server.
    const started = await repos.generations.start({ kind: 'resume', jdId: confirmed.id, origin: 'build', build: { added: ['Docker'], skipped: [] } });
    expect(started.resumeId).toMatch(/^[0-9a-f-]{36}$/);
    const finished = (id: string) =>
      new Promise<{ status: string; resumeId?: string }>((resolve) => {
        const stop = repos.generations.subscribe(id, (g) => {
          if (g.status === 'ready' || g.status === 'failed') {
            stop();
            resolve(g);
          }
        });
      });
    const done = await finished(started.id);
    expect(done.status).toBe('ready');

    // 3. The finished document is in the app's library: card, body and score panel.
    const resume = await repos.resumes.get(started.resumeId!);
    expect(resume.status).toBe('ready');
    const content = await repos.resumes.getContent(started.resumeId!);
    expect(content.kind === 'resume' && content.experience[0]?.company).toBe('Lumen Pay');
    const score = await repos.resumes.getScore(started.resumeId!);
    expect(score.report?.provenance.rubric).toBe('rubric-2');
    expect(resume.atsScore).toBe(score.total);
    // BUILD 04c's answer joined the profile before the run read it.
    const skills = await h.db.withUser({ userId: user.id, role: 'user' }, (tx) => tx.selectFrom('profile_skills').select('raw_name').where('user_id', '=', user.id).execute());
    expect(skills.map((s) => s.raw_name)).toContain('Docker');

    // 4. Interview practice on that resume runs on the server too (P11-08), and its marks persist.
    const practice = await repos.generations.start({ kind: 'interview', sourceResumeId: started.resumeId! });
    expect(practice.id).toMatch(/^[0-9a-f-]{36}$/);
    expect((await finished(practice.id)).status).toBe('ready');
    const set = (await repos.interview.getByGeneration(practice.id))!;
    expect(set).toMatchObject({ source: 'resume', resumeId: started.resumeId });
    expect(set.questions.length).toBeGreaterThanOrEqual(10);
    for (const q of set.questions.filter((x) => x.kind === 'technical')) expect(['Go', 'Kubernetes', 'Docker']).toContain(q.skill);
    const marked = await repos.interview.markQuestion(set.id, set.questions[0]!.id, 'needs_work');
    expect(marked.questions[0]!.mark).toBe('needs_work');
    expect((await repos.interview.list()).map((s) => s.id)).toContain(set.id);
    await repos.interview.remove(set.id);
    expect(await repos.interview.getByGeneration(practice.id)).toBeNull();

    // A run from a library document stays on the mock: the server never sees it.
    const before = await h.db.withUser({ userId: user.id, role: 'user' }, (tx) => tx.selectFrom('generations').select('id').execute());
    const local = await repos.generations.start({ kind: 'resume', baseResumeId: 'res_base', jobId: 'job_stripe' });
    expect(local.id).not.toMatch(/^[0-9a-f-]{36}$/);
    const after = await h.db.withUser({ userId: user.id, role: 'user' }, (tx) => tx.selectFrom('generations').select('id').execute());
    expect(after).toHaveLength(before.length);
  }, 90_000);
});
