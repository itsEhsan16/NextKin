import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LlmError } from '../../src/ai/types';
import { loadConfig } from '../../src/config';
import { createDatabase, type Database } from '../../src/db/database';
import { createRunner, MAX_RECEIVES, type RunnerHooks } from '../../src/pipeline/runner';
import { HELLO_PIPELINES, helloPipeline, StageError, type PipelineDef } from '../../src/pipeline/stages';
import * as generations from '../../src/services/generations';
import { capturingPublisher, createUser, deleteUsers, fakeGateway, key, log } from './fixtures/pipeline';

/**
 * The pipeline runner and the generation lifecycle against Postgres (ImBackendImplementationPlan
 * P6-04, P6-05). The crash-injection matrix is the P6-04 exit gate: for every stage boundary, a
 * crash before the commit and a crash after it, then a redelivery — and the run must finish with
 * each stage committed once and the quota charged once.
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

class Crash extends Error {}

async function newRun(kind: 'resume' | 'cover_letter' = 'resume', plan: 'free' | 'pro' = 'free') {
  const userId = await createUser(db, users, plan);
  const { generation } = await generations.startGeneration(db, { userId, role: 'user' }, { kind, title: 'Platform Engineer' }, { idempotencyKey: key(), correlationId: null });
  return { userId, id: generation.id, message: { generationId: generation.id, userId, correlationId: null, receiveCount: 1 } };
}

async function state(userId: string, id: string) {
  return db.withUser({ userId, role: 'user' }, async (tx) => ({
    row: await tx.selectFrom('generations').selectAll().where('id', '=', id).executeTakeFirstOrThrow(),
    events: await tx.selectFrom('generation_events').select(['event', 'stage']).where('generation_id', '=', id).orderBy('id').execute(),
    // What is charged or still held: a run reserves its slot at start (P12-09), so a row with
    // nothing used and nothing reserved means nothing was spent.
    usage: await tx.selectFrom('usage_counters').select(['metric', 'used', 'reserved']).where('user_id', '=', userId).where((eb) => eb.or([eb('used', '>', 0), eb('reserved', '>', 0)])).execute(),
    activity: await tx.selectFrom('activity').select('kind').where('user_id', '=', userId).execute(),
  }));
}

const runner = (hooks?: RunnerHooks, pipelines?: Record<string, PipelineDef>) =>
  // The runner's own guarantees, on hello-world pipelines (the real stages have their own suite).
  createRunner({ db, gateway: fakeGateway(db), publisher: capturingPublisher(), log, pipelines: (pipelines ?? HELLO_PIPELINES) as typeof HELLO_PIPELINES }, hooks);

describe('a run end to end', () => {
  it('walks every stage, records each event, charges once, and leaves an activity entry', async () => {
    const { userId, id, message } = await newRun();
    const publisher = capturingPublisher();
    const outcome = await createRunner({ db, gateway: fakeGateway(db), publisher, log, pipelines: HELLO_PIPELINES }).run(message);
    expect(outcome).toBe('completed');
    const s = await state(userId, id);
    expect(s.row).toMatchObject({ status: 'ready', attempt: 1, current_stage: null });
    expect(s.row.quota_charged_at).not.toBeNull();
    expect(s.row.prompt_template_version_id).not.toBeNull(); // G12: the version is pinned
    expect((s.row.checkpoint as { completed: string[] }).completed).toEqual(['draft', 'check', 'score']);
    expect(s.events.map((e) => `${e.event}:${e.stage ?? ''}`)).toEqual([
      'stage_started:draft', 'stage_completed:draft', 'stage_started:check', 'stage_completed:check', 'stage_started:score', 'stage_completed:score', 'completed:',
    ]);
    expect(publisher.events.map((e) => e.event.event).at(-1)).toBe('completed');
    expect(publisher.events.at(-1)!.event.data).toMatchObject({ status: 'ready', progress: 1 });
    expect(s.usage).toEqual([{ metric: 'generation', used: 1, reserved: 0 }]);
    expect(s.activity).toEqual([{ kind: 'generation' }]);
    expect(await runner().run(message)).toBe('skipped'); // a duplicate delivery changes nothing
    expect((await state(userId, id)).usage).toEqual([{ metric: 'generation', used: 1, reserved: 0 }]);
  });

  it('the stage log records the model call behind each AI stage', async () => {
    const { userId, id, message } = await newRun();
    await runner().run(message);
    const log = (await state(userId, id)).row.stage_log as { stage: string; provider?: string; model?: string }[];
    expect(log[0]).toMatchObject({ stage: 'draft', provider: 'fake', model: 'claude-haiku-4-5' });
  });
});

describe('the crash-injection matrix (P6-04 exit gate)', () => {
  const boundaries = ['start', 'after:draft', 'after:check', 'after:score', 'complete'];
  for (const boundary of boundaries) {
    for (const phase of ['beforeCommit', 'afterCommit'] as const) {
      it(`${boundary}, ${phase === 'beforeCommit' ? 'crash before the commit' : 'crash after the commit, before the ack'}`, async () => {
        const { userId, id, message } = await newRun();
        let crashed = false;
        const hooks: RunnerHooks = {
          [phase]: (at: string) => {
            if (at === boundary && !crashed) {
              crashed = true;
              throw new Crash(`crash at ${at}`);
            }
          },
        };
        await expect(runner(hooks).run(message)).rejects.toBeInstanceOf(Crash);
        // Redelivery: the same message again, on a fresh runner (a new process).
        // After the final commit the run is already done: the redelivery is skipped, not re-run.
        const expected = boundary === 'complete' && phase === 'afterCommit' ? 'skipped' : 'completed';
        expect(await runner().run({ ...message, receiveCount: 2 })).toBe(expected);
        const s = await state(userId, id);
        expect(s.row.status).toBe('ready');
        expect((s.row.checkpoint as { completed: string[] }).completed).toEqual(['draft', 'check', 'score']);
        for (const stage of ['draft', 'check', 'score']) expect(s.events.filter((e) => e.event === 'stage_completed' && e.stage === stage)).toHaveLength(1);
        expect(s.events.filter((e) => e.event === 'completed')).toHaveLength(1);
        expect(s.usage).toEqual([{ metric: 'generation', used: 1, reserved: 0 }]);
        expect(s.activity).toHaveLength(1);
      });
    }
  }
});

describe('the lifecycle (P6-05)', () => {
  it('a duplicate POST (same key) starts one run and one message', async () => {
    const userId = await createUser(db, users);
    const k = key();
    const a = await generations.startGeneration(db, { userId, role: 'user' }, { kind: 'resume' }, { idempotencyKey: k, correlationId: null });
    const b = await generations.startGeneration(db, { userId, role: 'user' }, { kind: 'resume' }, { idempotencyKey: k, correlationId: null });
    expect([a.created, b.created]).toEqual([true, false]);
    expect(b.generation.id).toBe(a.generation.id);
    const outbox = await db.withSystem('test: outbox rows', (tx) => tx.selectFrom('outbox').select('id').where(({ eb, ref }) => eb(ref('payload'), '@>', JSON.stringify({ payload: { generationId: a.generation.id } }) as never)).execute());
    expect(outbox).toHaveLength(1);
  });

  it('Pro runs are announced on the priority queue, Free on the standard one', async () => {
    const free = await newRun('resume', 'free');
    const pro = await newRun('resume', 'pro');
    const queues = await db.withSystem('test: outbox queues', (tx) =>
      tx.selectFrom('outbox').select(['queue', 'payload']).where('published_at', 'is', null).execute(),
    );
    const queueOf = (id: string) => queues.find((q) => (q.payload as { payload: { generationId: string } }).payload.generationId === id)?.queue;
    expect([queueOf(free.id), queueOf(pro.id)]).toEqual(['generation-standard', 'generation-priority']);
  });

  it('cancelling a queued run ends it at once; the worker then skips it; nothing is charged', async () => {
    const { userId, id, message } = await newRun();
    const cancelled = await generations.cancelGeneration(db, { userId, role: 'user' }, capturingPublisher(), id);
    expect(cancelled).toMatchObject({ status: 'failed', error: 'Cancelled.' });
    expect(await runner().run(message)).toBe('skipped');
    expect((await state(userId, id)).usage).toEqual([]);
  });

  it('cancelling a running run ends it at the next stage boundary, uncharged', async () => {
    const { userId, id, message } = await newRun();
    const cancelling: PipelineDef = {
      ...helloPipeline,
      stages: [
        { name: 'draft', status: 'generating', run: async () => { await generations.cancelGeneration(db, { userId, role: 'user' }, capturingPublisher(), id); return { output: {} }; } },
        ...helloPipeline.stages.slice(1),
      ],
    };
    expect(await runner(undefined, { resume: cancelling }).run(message)).toBe('failed');
    const s = await state(userId, id);
    expect(s.row).toMatchObject({ status: 'failed', error_code: 'cancelled', quota_charged_at: null });
    expect(s.usage).toEqual([]);
  });

  it('retry resumes from the first incomplete stage; completed stages are not re-run', async () => {
    const { userId, id, message } = await newRun();
    let draftRuns = 0;
    let checkFails = true;
    const flaky: PipelineDef = {
      ...helloPipeline,
      stages: [
        { name: 'draft', status: 'generating', run: async () => { draftRuns++; return { output: { summary: 'ok' } }; } },
        { name: 'check', status: 'validating', run: async () => { if (checkFails) throw new StageError('bad', 'nope'); return { output: {} }; } },
        helloPipeline.stages[2]!,
      ],
    };
    expect(await runner(undefined, { resume: flaky }).run(message)).toBe('failed');
    expect((await state(userId, id)).row).toMatchObject({ status: 'failed', error_code: 'bad' });
    checkFails = false;
    await generations.retryGeneration(db, { userId, role: 'user' }, capturingPublisher(), id, null);
    expect(await runner(undefined, { resume: flaky }).run({ ...message, receiveCount: 1 })).toBe('completed');
    expect(draftRuns).toBe(1);
    expect((await state(userId, id)).usage).toEqual([{ metric: 'generation', used: 1, reserved: 0 }]);
  });

  it('a transient failure is redelivered; on the last allowed receive the run fails before dead-lettering', async () => {
    const { userId, id, message } = await newRun();
    const down = createRunner({ db, gateway: fakeGateway(db, () => new LlmError('overloaded', 'busy', true)), publisher: capturingPublisher(), log, pipelines: HELLO_PIPELINES });
    await expect(down.run(message)).rejects.toBeInstanceOf(LlmError);
    expect((await state(userId, id)).row.status).toBe('generating');
    await expect(down.run({ ...message, receiveCount: MAX_RECEIVES })).rejects.toBeInstanceOf(LlmError);
    expect((await state(userId, id)).row).toMatchObject({ status: 'failed', error_code: 'dead_lettered', error_message: 'We couldn’t finish this. Try again.' });
  });

  it('the sweep fails anything unfinished past the timeout, with its event', async () => {
    const { userId, id } = await newRun();
    await db.withSystem('test: age a run', (tx) => tx.updateTable('generations').set({ created_at: new Date(Date.now() - 10 * 60_000) }).where('id', '=', id).execute());
    const publisher = capturingPublisher();
    expect(await generations.sweepStuckGenerations(db, publisher, 180)).toBeGreaterThanOrEqual(1);
    const s = await state(userId, id);
    expect(s.row).toMatchObject({ status: 'failed', error_code: 'timed_out' });
    expect(s.events.at(-1)).toMatchObject({ event: 'failed' });
    expect(publisher.events.some((e) => e.generationId === id && e.event.event === 'failed')).toBe(true);
  });

  it('getActive returns the newest unfinished run', async () => {
    const { userId, id } = await newRun();
    expect((await generations.activeGeneration(db, { userId, role: 'user' }))?.id).toBe(id);
  });
});
