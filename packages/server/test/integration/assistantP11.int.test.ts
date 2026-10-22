import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { groundedModel } from '../../evals/referenceModel';
import { createAiGateway } from '../../src/ai/gateway';
import { createFakeProvider, type FakeScript } from '../../src/ai/providers/fake';
import { createAiSettings } from '../../src/ai/routing';
import { createDbTrace } from '../../src/ai/trace';
import { LlmError } from '../../src/ai/types';
import { createModelBrain, createStandInBrain, dbPrompts, type AssistantBrain } from '../../src/assistant/brain';
import { loadConfig } from '../../src/config';
import { createDatabase, type Database } from '../../src/db/database';
import * as assistant from '../../src/services/assistant';
import { backendUser, readyJd, runToEnd } from './fixtures/documents';
import { createUser, deleteUsers, log } from './fixtures/pipeline';

/**
 * The assistant against Postgres (ImBackendImplementationPlan P11-09; V2 §7.16): the classifier
 * gates every message and an off-topic one costs one fast-tier call; the reply streams into its row
 * against a contact-free context that carries the requirement ledger; the daily cap holds and a
 * failed classification is not counted; chats are threads with one current.
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

function modelBrain(script: FakeScript) {
  const provider = createFakeProvider({ script });
  const gateway = createAiGateway({
    settings: createAiSettings(db, 0),
    providers: { resolve: (f) => (f === 'claude' ? provider : null), isDeveloperKey: () => false },
    trace: createDbTrace(db, log),
    log,
    developer: 'test',
    dailyCapUsd: 0,
    retryDelayMs: () => 0,
  });
  return { brain: createModelBrain(gateway, dbPrompts(db)), calls: provider.calls };
}

const scope = (inScope: boolean): FakeScript => (request) =>
  request.output?.name === 'assistant_scope' ? { data: { inScope, topic: inScope ? 'ats' : 'other' }, stopReason: 'tool_use', text: '' } : request.output ? groundedModel(request, 0) : { text: 'Your score is held back by two **missing** requirements.', stopReason: 'end_turn' };

const deps = (brain: AssistantBrain) => ({ db, brain, log, pending: new Set<Promise<void>>() });
const settle = async (d: { pending: Set<Promise<void>> }) => {
  while (d.pending.size) await Promise.allSettled([...d.pending]);
};

describe('the assistant (P11-09)', () => {
  it('answers in scope, streamed into the reply, against a contact-free context with the requirement ledger', async () => {
    const userId = await backendUser(db, users);
    const identity = { userId, role: 'user' as const };
    const jd = await readyJd(db, userId, groundedModel);
    const built = await runToEnd(db, userId, 'resume', { jdId: jd.id, origin: 'build' }, groundedModel);
    const { brain, calls } = modelBrain(scope(true));
    const d = deps(brain);

    const sent = await assistant.sendMessage(d, identity, { text: 'Why is my ATS score what it is?', resumeId: built.resumeId! });
    expect(sent.reply).toMatchObject({ role: 'assistant', status: 'streaming', text: '', contextResumeId: built.resumeId });
    await settle(d);
    const reply = await assistant.getMessage(db, identity, sent.reply.id);
    expect(reply.status).toBe('complete');
    expect(reply.text).toContain('missing');

    expect(calls.map((c) => c.model)).toEqual(['claude-haiku-5-5', 'claude-sonnet-5-5']);
    const replyInput = calls[1]!.messages[0]!.content;
    expect(replyInput).toContain('"requirements"');
    expect(replyInput).toContain('PostgreSQL');
    const email = (await db.withUser(identity, (tx) => tx.selectFrom('users').select('email').executeTakeFirstOrThrow())).email;
    expect(replyInput).not.toContain(email);

    const conversation = await assistant.getConversation(db, identity);
    expect(conversation.title).toBe('Why is my ATS score what it is?');
    expect(conversation.messages.map((m) => m.role)).toEqual(['user', 'assistant']);
  }, 60_000);

  it('declines an off-topic message with one fast-tier call and the fixed refusal', async () => {
    const userId = await createUser(db, users);
    const identity = { userId, role: 'user' as const };
    const { brain, calls } = modelBrain(scope(false));
    const d = deps(brain);
    const sent = await assistant.sendMessage(d, identity, { text: 'Give me a recipe for banana bread.' });
    await settle(d);
    expect(sent.reply).toMatchObject({ status: 'complete', refusal: 'off_topic' });
    expect(sent.reply.text).toMatch(/outside what I can help with/);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.model).toBe('claude-haiku-5-5');
    // §7.16: a refusal is kept by topic class only.
    const row = await db.withUser(identity, (tx) => tx.selectFrom('chat_messages').select(['refusal', 'classification']).where('id', '=', sent.reply.id).executeTakeFirstOrThrow());
    expect(row).toMatchObject({ refusal: 'off_topic', classification: { inScope: false, topic: null } });
  });

  it('holds the daily cap (refusals count), and does not count a message the classifier never judged', async () => {
    const userId = await createUser(db, users);
    const identity = { userId, role: 'user' as const };
    const d = deps(createStandInBrain());
    await db.withUser(identity, (tx) =>
      tx.insertInto('usage_counters').values({ user_id: userId, metric: 'assistant_message', period_start: sql`(now() at time zone 'utc')::date`, period_end: sql`((now() at time zone 'utc')::date + 1)`, used: 19 }).execute(),
    );
    await assistant.sendMessage(d, identity, { text: 'Tell me a joke.' });
    await expect(assistant.sendMessage(d, identity, { text: 'Why is my ATS score low?' })).rejects.toMatchObject({ code: 'RATE_LIMITED', details: { reason: 'assistant_daily', limit: 20 } });

    const other = await createUser(db, users);
    const failing = modelBrain(() => new LlmError('unavailable', 'down', false));
    await expect(assistant.sendMessage(deps(failing.brain), { userId: other, role: 'user' }, { text: 'Why is my ATS score low?' })).rejects.toMatchObject({ code: 'UNAVAILABLE' });
    const used = await db.withUser({ userId: other, role: 'user' }, (tx) => tx.selectFrom('usage_counters').select('used').where('metric', '=', 'assistant_message').executeTakeFirst());
    expect(used?.used ?? 0).toBe(0);
    expect((await assistant.getConversation(db, { userId: other, role: 'user' })).messages).toHaveLength(0);
  });

  it('keeps one current chat beside its history: new, open, clear', async () => {
    const userId = await createUser(db, users, 'pro');
    const identity = { userId, role: 'user' as const };
    const d = deps(createStandInBrain());
    await assistant.sendMessage(d, identity, { text: 'How do I explain a career gap?' });
    const first = await assistant.getConversation(db, identity);
    const fresh = await assistant.startNew(db, identity);
    expect(fresh.id).not.toBe(first.id);
    expect((await assistant.startNew(db, identity)).id).toBe(fresh.id); // an empty chat is not filed
    await assistant.sendMessage(d, identity, { text: 'Should my resume be one page?' });
    await settle(d);

    let threads = await assistant.listThreads(db, identity);
    expect(threads.map((t) => [t.id, t.current])).toEqual([
      [fresh.id, true],
      [first.id, false],
    ]);
    expect(threads[1]!.preview.length).toBeGreaterThan(0);

    const reopened = await assistant.openThread(db, identity, first.id);
    expect(reopened.messages[0]!.text).toBe('How do I explain a career gap?');
    threads = await assistant.listThreads(db, identity);
    expect(threads.find((t) => t.current)!.id).toBe(first.id);

    const cleared = await assistant.clearConversation(db, identity);
    expect(cleared).toMatchObject({ id: first.id, messages: [] });
    expect(cleared.title).toBeUndefined();
  });

  it('reads a reply whose writer died mid-stream as failed', async () => {
    const userId = await createUser(db, users);
    const identity = { userId, role: 'user' as const };
    const never: AssistantBrain = { kind: 'stand-in', classify: async () => ({ inScope: true, topic: 'ats' }), reply: () => new Promise(() => {}) };
    const sent = await assistant.sendMessage({ db, brain: never, log }, identity, { text: 'Why is my ATS score low?' });
    await db.withUser(identity, (tx) => tx.updateTable('chat_messages').set({ created_at: sql`now() - interval '10 minutes'` }).where('id', '=', sent.reply.id).execute());
    expect((await assistant.getMessage(db, identity, sent.reply.id)).status).toBe('failed');
  });
});
