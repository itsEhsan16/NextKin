import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { groundedModel } from '../../evals/referenceModel';
import { createAiGateway } from '../../src/ai/gateway';
import { createFakeProvider, type FakeScript } from '../../src/ai/providers/fake';
import { createAiSettings } from '../../src/ai/routing';
import { createDbTrace } from '../../src/ai/trace';
import { createModelBrain, dbPrompts } from '../../src/assistant/brain';
import { loadConfig } from '../../src/config';
import { createDatabase, type Database } from '../../src/db/database';
import * as assistant from '../../src/services/assistant';
import { readContent } from '../../src/services/resumeRead';
import { backendUser, readyJd, runToEnd } from './fixtures/documents';
import { createUser, deleteUsers, log } from './fixtures/pipeline';

/**
 * The assistant after toreview §109: a greeting is answered at once, uncounted and with no model
 * call; and the reply reads the open document's own text, with the contact details and the user's
 * name taken out.
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
  const gateway = createAiGateway({ settings: createAiSettings(db, 0), providers: { resolve: (f) => (f === 'claude' ? provider : null), isDeveloperKey: () => false }, trace: createDbTrace(db, log), log, developer: 'test', dailyCapUsd: 0, retryDelayMs: () => 0 });
  return { brain: createModelBrain(gateway, dbPrompts(db)), calls: provider.calls };
}

const inScope: FakeScript = (request) =>
  request.output?.name === 'assistant_scope' ? { data: { inScope: true, topic: 'resume' }, stopReason: 'tool_use', text: '' } : request.output ? groundedModel(request, 0) : { text: 'The second role needs a number.', stopReason: 'end_turn' };

const settle = async (d: { pending: Set<Promise<void>> }) => {
  while (d.pending.size) await Promise.allSettled([...d.pending]);
};

describe('the assistant after §109', () => {
  it('answers a greeting at once: no model call, not counted', async () => {
    const userId = await createUser(db, users);
    const identity = { userId, role: 'user' as const };
    const { brain, calls } = modelBrain(inScope);
    const d = { db, brain, log, pending: new Set<Promise<void>>() };
    const sent = await assistant.sendMessage(d, identity, { text: 'Hi!' });
    expect(sent.reply).toMatchObject({ role: 'assistant', status: 'complete' });
    expect(sent.reply.text).toMatch(/^Hi! I’m NextKin’s career assistant\./);
    expect(sent.reply.refusal).toBeUndefined();
    expect(calls).toHaveLength(0);
    const counted = await db.withUser(identity, (tx) => tx.selectFrom('usage_counters').select('used').where('metric', '=', 'assistant_message').execute());
    expect(counted.reduce((n, r) => n + r.used, 0)).toBe(0);
    expect((await assistant.getConversation(db, identity)).messages.map((m) => m.role)).toEqual(['user', 'assistant']);
  });

  it("reads the open resume's own lines, never its contact details or the user's name", async () => {
    const userId = await backendUser(db, users);
    const identity = { userId, role: 'user' as const };
    const jd = await readyJd(db, userId, groundedModel);
    const built = await runToEnd(db, userId, 'resume', { jdId: jd.id, origin: 'build' }, groundedModel);
    // A surname that also appears in the resume shows the name is taken out wherever it is written.
    await db.withUser(identity, (tx) => tx.updateTable('users').set({ first_name: 'Jo', last_name: 'Cartwheel' }).where('id', '=', userId).execute());
    const content = await db.withUser(identity, (tx) => readContent(tx, userId, built.resumeId!));
    const bullet = content?.kind === 'resume' ? content.experience[0]?.bullets[0] : undefined;
    expect(bullet).toBeTruthy();

    const { brain, calls } = modelBrain(inScope);
    const d = { db, brain, log, pending: new Set<Promise<void>>() };
    await assistant.sendMessage(d, identity, { text: 'What is wrong in my resume?', resumeId: built.resumeId! });
    await settle(d);

    const replyInput = calls[1]!.messages[0]!.content;
    expect(replyInput).toContain('"body"');
    expect(replyInput).toContain(bullet!.slice(0, 40));
    expect(replyInput).not.toContain('Cartwheel');
    const email = (await db.withUser(identity, (tx) => tx.selectFrom('users').select('email').executeTakeFirstOrThrow())).email;
    expect(replyInput).not.toContain(email);
    expect(calls[0]!.messages[0]!.content).toMatch(/"hasAttachment":\s*true/);
  }, 60_000);
});
